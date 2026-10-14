// truonglt phase1 database start
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export type Probe = { ok: number; timezone: string; tls: boolean };
export interface DatabaseClient {
  $queryRaw<T>(strings: TemplateStringsArray): Promise<T>;
  $disconnect(): Promise<void>;
}

export function createDatabaseClient(connectionString: string): PrismaClient {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.password || !url.hostname) {
    throw new Error('INVALID_DATABASE_CONFIGURATION');
  }
  const mode = url.searchParams.get('sslmode');
  if (mode && !['require', 'verify-ca', 'verify-full'].includes(mode)) {
    throw new Error('TLS_REQUIRED');
  }
  // Configure TLS explicitly; URL SSL parameters must not override certificate validation.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const caPath = process.env.DATABASE_CA_CERT_PATH;
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}) },
    max: 4,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    query_timeout: 3000,
    statement_timeout: 3000,
    // Phase 1 connections can only read. Revisit deliberately at Phase 2.
    options: '-c timezone=UTC -c default_transaction_read_only=on',
  });
  return new PrismaClient({ adapter, log: [] });
}

export async function probeDatabase(client: DatabaseClient): Promise<Probe> {
  const rows = await client.$queryRaw<Probe[]>`
    SELECT 1::integer AS ok,
      current_setting('TimeZone') AS timezone,
      (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls
  `;
  if (rows.length !== 1 || rows[0].ok !== 1 || rows[0].timezone !== 'UTC' || rows[0].tls !== true) {
    throw new Error('DATABASE_VERIFICATION_FAILED');
  }
  return rows[0];
}

export function sanitizedDatabaseError(error: unknown): string {
  // Allowlisted categories only; never return/log driver message, URL, user, SQL or stack.
  const adapterKind = (error as { meta?: { driverAdapterError?: { cause?: { kind?: string } } } })
    ?.meta?.driverAdapterError?.cause?.kind;
  if (adapterKind === 'DatabaseNotReachable') return 'DATABASE_NOT_REACHABLE';
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'P1000', 'P1001', 'P1002', 'P1011']
    .includes(code) ? code : 'DATABASE_UNAVAILABLE';
}
// truonglt phase1 database end
