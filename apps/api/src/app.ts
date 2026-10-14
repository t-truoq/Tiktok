// truonglt phase1 app start
import 'reflect-metadata';
import { Logger, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
// truonglt bounded private image JSON payload start
import { NestExpressApplication } from '@nestjs/platform-express';
// truonglt bounded private image JSON payload end
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createDatabaseClient, DatabaseClient, sanitizedDatabaseError, unavailableDatabaseClient, databaseErrorReason } from './database';
import { DATABASE, HealthController } from './health';
// truonglt Phase3 fail-closed business module start
import { BusinessModule } from './business/controller';
// truonglt Phase4 read runtime bootstrap verification start
import { BusinessRepository } from './business/repository';
// truonglt Phase4 read runtime bootstrap verification end
// truonglt Phase3 fail-closed business module end

@Module({
  controllers: [HealthController],
  providers: [{
    provide: DATABASE,
    useFactory: () => {
      if (!process.env.DATABASE_URL) return null;
      try {
        return createDatabaseClient(process.env.DATABASE_URL);
      } catch (error) {
        new Logger('Database').warn(JSON.stringify({ event: 'database_configuration_failed',
          code: sanitizedDatabaseError(error), reason: databaseErrorReason(error) }));
        // truonglt preserve safe configuration failure for readiness start
        return unavailableDatabaseClient(error);
        // truonglt preserve safe configuration failure for readiness end
      }
    },
  }],
})
export class AppModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient | null) {}
  async onApplicationShutdown() {
    await this.database?.$disconnect();
  }
}

export async function createApp() {
  config({ path: resolve(__dirname, '../.env'), quiet: true });
  // truonglt Phase3.1 public business route enablement start
  // Disabled means no Business API routes are registered, not merely rejected writes.
  const entryModule = { module: AppModule, imports: process.env.BUSINESS_API_ENABLED === 'true' ? [BusinessModule] : [] };
  const app = await NestFactory.create<NestExpressApplication>(entryModule, { logger: ['error', 'warn'] });
  // truonglt 2MiB image encoded as base64 with bounded request size start
  app.useBodyParser('json', { limit: '3mb' });
  // truonglt 2MiB image encoded as base64 with bounded request size end
  // truonglt Phase3.1 public business route enablement end
  app.setGlobalPrefix('api/v1');
  // truonglt Phase4 exact CORS allowlist and deployment evidence start
  const origins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) throw new Error('INVALID_CORS_ORIGIN');
  }
  if (origins.length) app.enableCors({ origin: origins, credentials: false, methods: ['GET', 'HEAD', 'OPTIONS', ...(process.env.BUSINESS_WRITE_ENABLED === 'true' ? ['POST'] : [])],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'], exposedHeaders: ['X-Backend-Revision', 'X-Business-Mode'] });
  app.use((_req: unknown, res: any, next: () => void) => {
    const revision = process.env.RENDER_GIT_COMMIT;
    if (revision && /^[a-f0-9]{40}$/.test(revision)) res.setHeader('X-Backend-Revision', revision);
    res.setHeader('X-Business-Mode', process.env.BUSINESS_API_ENABLED !== 'true' ? 'disabled' : process.env.BUSINESS_WRITE_ENABLED === 'true' ? 'read-write' : 'read-only');
    next();
  });
  if (process.env.BUSINESS_API_ENABLED === 'true') {
    try { await app.get(BusinessRepository).db(); } catch (error) { await app.close(); throw error; }
  }
  // truonglt Phase4 exact CORS allowlist and deployment evidence end
  app.enableShutdownHooks();
  return app;
}
// truonglt phase1 app end
