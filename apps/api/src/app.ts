// truonglt phase1 app start
import 'reflect-metadata';
import { Logger, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createDatabaseClient, DatabaseClient, sanitizedDatabaseError, unavailableDatabaseClient, databaseErrorReason } from './database';
import { DATABASE, HealthController } from './health';
// truonglt Phase3 fail-closed business module start
import { BusinessModule } from './business/controller';
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
  const app = await NestFactory.create(entryModule, { logger: ['error', 'warn'] });
  // truonglt Phase3.1 public business route enablement end
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  return app;
}
// truonglt phase1 app end
