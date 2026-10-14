// truonglt phase1 health start
import { Controller, Get, Inject, Logger, Res } from '@nestjs/common';
import { DatabaseClient, probeDatabase, sanitizedDatabaseError } from './database';

export const DATABASE = Symbol('DATABASE');
type HealthResponse = {
  status(code: number): HealthResponse;
  setHeader(name: string, value: string): void;
  json(body: object): void;
};

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient | null) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res() response: HealthResponse) {
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (!this.database) throw new Error('DATABASE_NOT_CONFIGURED');
      const result = await probeDatabase(this.database);
      response.status(200).json({ status: 'ready', database: 'ok', tls: result.tls,
        timezone: result.timezone, tlsScope: result.tlsScope, tlsProtocol: result.tlsProtocol,
        postgresSessionTls: result.postgresSessionTls });
    } catch (error) {
      this.logger.warn(JSON.stringify({ event: 'database_readiness_failed', code: sanitizedDatabaseError(error) }));
      response.setHeader('Content-Type', 'application/problem+json');
      response.status(503).json({ type: 'about:blank', title: 'Cơ sở dữ liệu chưa sẵn sàng',
        status: 503, detail: 'Kiểm tra cấu hình kết nối và trạng thái Supabase DEV, rồi thử lại.' });
    }
  }
}
// truonglt phase1 health end
