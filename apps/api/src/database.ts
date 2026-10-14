// truonglt phase1 database start
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { Client, Pool } from 'pg';
import { TLSSocket } from 'node:tls';
import { X509Certificate } from 'node:crypto';

// truonglt explicit provider CA validation start
export function databaseTlsOptions(hostname: string, caPath = process.env.DATABASE_CA_CERT_PATH) {
  // Supabase's private root is not guaranteed to be in a Linux/Node trust store.
  if (!caPath && /(?:^|\.)supabase\.(?:com|co)$/.test(hostname)) throw Error('CA_FILE_NOT_FOUND');
  let ca: string | undefined;
  if (caPath) {
    try { ca = readFileSync(caPath, 'utf8'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Error('CA_FILE_NOT_FOUND');
      throw Error('CA_FILE_UNREADABLE');
    }
    try {
      const blocks = ca.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
      if (!blocks?.length) throw Error('INVALID_PEM');
      for (const block of blocks) {
        const certificate = new X509Certificate(block);
        if (!certificate.ca || Date.now() < Date.parse(certificate.validFrom) ||
            Date.now() > Date.parse(certificate.validTo)) throw Error('INVALID_CA');
      }
    } catch { throw Error('TLS_CERTIFICATE_INVALID'); }
  }
  return { rejectUnauthorized: true as const, servername: hostname, ...(ca ? { ca } : {}) };
}
// truonglt explicit provider CA validation end

export type Transport = { encrypted: boolean; authorized: boolean; protocol: string | null };
export type Probe = { ok: number; timezone: string; tls: boolean;
  tlsScope: 'client-to-endpoint'; tlsProtocol: string; postgresSessionTls: boolean };
export interface DatabaseClient {
  $queryRaw<T>(strings: TemplateStringsArray): Promise<T>;
  verifyTransport(): Promise<Transport>;
  $disconnect(): Promise<void>;
}

class ReadonlyDatabaseClient implements DatabaseClient {
  private readonly prisma: PrismaClient;
  constructor(private readonly pool: Pool) {
    this.prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: [] });
  }

  async verifyTransport(): Promise<Transport> {
    const connection = await this.pool.connect();
    try {
      // PoolClient is a pg.Client at runtime; inspect its actual TLS socket, not pg_stat_ssl.
      const socket = (connection as unknown as Client).connection.stream;
      return { encrypted: socket instanceof TLSSocket && socket.encrypted,
        authorized: socket instanceof TLSSocket && socket.authorized,
        protocol: socket instanceof TLSSocket ? socket.getProtocol() : null };
    } finally {
      connection.release();
    }
  }

  $queryRaw<T>(strings: TemplateStringsArray): Promise<T> {
    // Supavisor can ignore startup options. Enforce read-only inside each transaction.
    return this.prisma.$transaction(async transaction => {
      await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
      return transaction.$queryRaw<T>(strings);
    });
  }

  async $disconnect(): Promise<void> {
    try { await this.prisma.$disconnect(); } finally { await this.pool.end(); }
  }
}

// truonglt pg connection string TLS override protection start
export function databaseConnectionOptions(connectionString: string, caPath = process.env.DATABASE_CA_CERT_PATH) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.password || !url.hostname) {
    throw new Error('INVALID_DATABASE_CONFIGURATION');
  }
  const mode = url.searchParams.get('sslmode');
  if (mode && !['require', 'verify-ca', 'verify-full'].includes(mode)) {
    throw new Error('TLS_REQUIRED');
  }
  if (['0', 'false'].includes(url.searchParams.get('ssl') || '')) throw Error('TLS_REQUIRED');
  // Configure TLS explicitly; URL SSL parameters must not override certificate validation.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation', 'uselibpqcompat'])
    url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: databaseTlsOptions(url.hostname, caPath) };
}
// truonglt pg connection string TLS override protection end

export function createDatabaseClient(connectionString: string): DatabaseClient {
  const pool = new Pool({
    ...databaseConnectionOptions(connectionString),
    max: 4,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    query_timeout: 3000,
    statement_timeout: 3000,
    // Best-effort startup preference; query transactions enforce read-only above.
    options: '-c timezone=UTC -c default_transaction_read_only=on',
  });
  pool.on('error', error => {
    console.warn(JSON.stringify({ event: 'database_pool_error', code: sanitizedDatabaseError(error) }));
  });
  return new ReadonlyDatabaseClient(pool);
}

export async function probeDatabase(client: DatabaseClient): Promise<Probe> {
  const transport = await client.verifyTransport();
  if (!transport.encrypted || !transport.authorized ||
      !['TLSv1.2', 'TLSv1.3'].includes(transport.protocol || '')) {
    throw new Error('DATABASE_TLS_VERIFICATION_FAILED');
  }
  const rows = await client.$queryRaw<{ ok: number; timezone: string; tls: boolean }[]>`
    SELECT 1::integer AS ok,
      current_setting('TimeZone') AS timezone,
      (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls
  `;
  if (rows.length !== 1 || rows[0].ok !== 1 || rows[0].timezone !== 'UTC' || typeof rows[0].tls !== 'boolean') {
    throw new Error('DATABASE_VERIFICATION_FAILED');
  }
  return { ok: rows[0].ok, timezone: rows[0].timezone, tls: true,
    tlsScope: 'client-to-endpoint', tlsProtocol: transport.protocol!, postgresSessionTls: rows[0].tls };
}

export async function inspectDatabase(client: DatabaseClient) {
  const identity = await client.$queryRaw<{ database: string; schema: string; readOnly: string }[]>`
    SELECT current_database() AS database, current_schema() AS schema,
      current_setting('transaction_read_only') AS "readOnly"
  `;
  if (identity.length !== 1 || identity[0].readOnly !== 'on') {
    throw new Error('READ_ONLY_INSPECTION_REQUIRED');
  }
  const schemas = await client.$queryRaw<{ name: string }[]>`
    SELECT nspname AS name FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY nspname
  `;
  const publicObjects = await client.$queryRaw<{ name: string; kind: string }[]>`
    SELECT c.relname AS name, c.relkind::text AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
    ORDER BY c.relname
  `;
  const migrationHistory = await client.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists
  `;
  return { identity, schemas, publicObjects, migrationHistory,
    inspectionOnly: true, migrationsExecuted: false };
}

export function sanitizedDatabaseError(error: unknown): string {
  // Allowlisted categories only; never return/log driver message, URL, user, SQL or stack.
  const adapterKind = (error as { meta?: { driverAdapterError?: { cause?: { kind?: string } } } })
    ?.meta?.driverAdapterError?.cause?.kind;
  if (adapterKind === 'DatabaseNotReachable') return 'DATABASE_NOT_REACHABLE';
  if (adapterKind === 'TlsConnectionError') return 'TLS_CERTIFICATE_INVALID';
  const message = error instanceof Error ? error.message : '';
  if (['CA_FILE_NOT_FOUND', 'CA_FILE_UNREADABLE', 'TLS_CERTIFICATE_INVALID'].includes(message)) return message;
  if (['DATABASE_TLS_VERIFICATION_FAILED', 'DATABASE_VERIFICATION_FAILED'].includes(message)) return message;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'P1011'].includes(code)) return 'TLS_CERTIFICATE_INVALID';
  return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'P1000', 'P1001', 'P1002']
    .includes(code) ? code : 'DATABASE_UNAVAILABLE';
}
// truonglt phase1 database end
