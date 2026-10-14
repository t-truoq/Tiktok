// truonglt Phase3 dedicated non-owner database repository start
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { databaseConnectionOptions } from '../database';
import { Actor, fail } from './contracts';
export const REQUIRED_RUNTIME_ROLE = 'tiktok_api_runtime';
export function assertRuntimeIdentity(role: { rolname: string; rolsuper: boolean; rolbypassrls: boolean; owned: number;
  rolcreaterole?: boolean; rolcreatedb?: boolean; can_create?: boolean; can_set_owner?: boolean; can_service?: boolean }) {
  if (role.rolname !== REQUIRED_RUNTIME_ROLE || role.rolsuper || role.rolbypassrls || Number(role.owned) !== 0 ||
      role.rolcreaterole !== false || role.rolcreatedb !== false || role.can_create !== false || role.can_set_owner !== false || role.can_service !== false) fail('UNSAFE_RUNTIME_ROLE', 503);
}
@Injectable()
export class BusinessRepository implements OnApplicationShutdown {
  private pool?: Pool; private client?: PrismaClient; private ready?: Promise<void>;
  async db() {
    // Deliberately no fallback to the postgres health/migration DATABASE_URL.
    if (process.env.BUSINESS_API_ENABLED !== 'true' || !process.env.RUNTIME_DATABASE_URL) fail('BUSINESS_API_DISABLED', 503);
    if (!this.client) {
      const options = databaseConnectionOptions(process.env.RUNTIME_DATABASE_URL);
      this.pool = new Pool({ ...options, max: 5, connectionTimeoutMillis: 10000 });
      this.client = new PrismaClient({ adapter: new PrismaPg(this.pool), log: [] });
      this.ready = this.client.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const rows = await tx.$queryRaw<any[]>`SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb,
          has_schema_privilege(current_user, 'public', 'CREATE') AS can_create,
          pg_has_role(current_user, 'postgres', 'SET') AS can_set_owner,
          pg_has_role(current_user, 'service_role', 'USAGE') AS can_service,
          (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relowner=r.oid) AS owned FROM pg_roles r WHERE r.rolname=current_user`;
        if (rows.length !== 1) fail('UNSAFE_RUNTIME_ROLE', 503); assertRuntimeIdentity(rows[0]);
      });
    }
    try { await this.ready; } catch { fail('RUNTIME_SECURITY_NOT_VERIFIED', 503); }
    return this.client;
  }
  async actor(subject: string) {
    return (await this.db()).$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$queryRaw`SELECT set_config('app.auth_subject', ${subject}, true)`;
      return tx.user.findUnique({ where: { authSubject: subject } });
    });
  }
  async read<T>(fn: (tx: any) => Promise<T>, actor: Actor): Promise<T> {
    return (await this.db()).$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$queryRaw`SELECT set_config('app.actor_id', ${actor.id}, true), set_config('app.auth_subject', ${actor.subject}, true)`;
      return fn(tx);
    // truonglt Phase5 bounded read transaction for paginated finance review start
    }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
    // truonglt Phase5 bounded read transaction for paginated finance review end
  }
  async transaction<T>(actor: Actor, fn: (tx: any) => Promise<T>): Promise<T> {
    return (await this.db()).$transaction(async tx => {
      // Context follows verified JWT + database identity, never request body actor_id.
      // GUC is a trusted-server authorization context, not a JWT verification primitive.
      await tx.$queryRaw`SELECT set_config('app.actor_id', ${actor.id}, true), set_config('app.auth_subject', ${actor.subject}, true)`;
      return fn(tx);
    }, { isolationLevel: 'Serializable', timeout: 15000 });
  }
  async onApplicationShutdown() { await this.client?.$disconnect(); await this.pool?.end(); }
}
// truonglt Phase3 dedicated non-owner database repository end
