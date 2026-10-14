// truonglt Phase3 authenticated REST controllers start
import { ArgumentsHost, Body, CallHandler, Catch, Controller, ExceptionFilter, ExecutionContext, Get, Headers, HttpException, Module, NestInterceptor, Param, Post, Query, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { map } from 'rxjs';
import { BusinessGuard } from './security';
import { BusinessRepository } from './repository';
import { BusinessService } from './service';
import { Actor, fail, mutationDto, uuid } from './contracts';
import { SourceDateError } from '../finance/source-time';
@Catch()
export class BusinessErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : exception instanceof SourceDateError ? 400 : 503;
    const body = exception instanceof HttpException ? exception.getResponse() : exception instanceof SourceDateError ? { code: exception.code } : { code: 'BUSINESS_DATABASE_UNAVAILABLE' };
    host.switchToHttp().getResponse().status(status).set('Cache-Control', 'no-store').json(body);
  }
}
export class BusinessSerialization implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context.switchToHttp().getResponse().set('Cache-Control', 'no-store');
    return next.handle().pipe(map(value => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item))));
  }
}
@Controller()
@UseGuards(BusinessGuard)
@UseFilters(BusinessErrorFilter)
@UseInterceptors(BusinessSerialization)
export class BusinessController {
  constructor(private readonly service: BusinessService) {}
  // truonglt Phase5 frontend capabilities from verified identity start
  @Get('session') session(@Req() req: { actor: Actor }) {
    return { actor: req.actor, timezone: 'Asia/Ho_Chi_Minh', writeEnabled: process.env.BUSINESS_WRITE_ENABLED === 'true',
      canWrite: process.env.BUSINESS_WRITE_ENABLED === 'true' && ['ADMIN', 'EDITOR'].includes(req.actor.role) };
  }
  // truonglt Phase5 frontend capabilities from verified identity end
  @Get('products') list(@Query() q: Record<string, unknown>, @Req() req: { actor: Actor }) { return this.service.list(q, req.actor); }
  @Get('finance/summary') summary(@Query() q: Record<string, unknown>, @Req() req: { actor: Actor }) { return this.service.summary(q, req.actor); }
  // truonglt Phase5 authorized workspace review and audit reads start
  @Get('finance/review') review(@Query() q: Record<string, unknown>, @Req() req: { actor: Actor }) { return this.service.review(q, req.actor); }
  @Get('history') history(@Query() q: Record<string, unknown>, @Req() req: { actor: Actor }) { return this.service.globalHistory(q, req.actor); }
  // truonglt Phase5 authorized workspace review and audit reads end
  @Get('products/:id') detail(@Param('id') id: string, @Req() req: { actor: Actor }) { return this.service.detail(uuid(id), req.actor); }
  @Get('products/:id/:resource') resource(@Param('id') id: string, @Param('resource') resource: string, @Query() q: Record<string, unknown>, @Req() req: { actor: Actor }) {
    return this.service.resource(uuid(id), resource, q, req.actor);
  }
  @Get('source-archives') sources(@Query() q: Record<string, unknown>, @Req() req: { actor: Actor }) { return this.service.metadata('sourceArchive', q, req.actor); }
  @Get('import-batches') batches(@Query() q: Record<string, unknown>, @Req() req: { actor: Actor }) { return this.service.metadata('importBatch', q, req.actor); }
  @Post('products/:id/mutations') mutate(@Param('id') id: string, @Body() body: unknown, @Headers('idempotency-key') key: string, @Req() req: { actor: Actor }) {
    // truonglt Phase4 independently disabled public writes start
    if (process.env.BUSINESS_WRITE_ENABLED !== 'true') fail('BUSINESS_WRITES_DISABLED', 403);
    // truonglt Phase4 independently disabled public writes end
    return this.service.mutate(uuid(id), mutationDto(body), req.actor, key);
  }
  // truonglt Phase5 server-calculated mutation preview without database writes start
  @Post('products/:id/preview') preview(@Param('id') id: string, @Body() body: unknown, @Req() req: { actor: Actor }) {
    return this.service.preview(uuid(id), mutationDto(body), req.actor);
  }
  // truonglt Phase5 server-calculated mutation preview without database writes end
}
@Module({ controllers: [BusinessController], providers: [BusinessRepository, BusinessService, BusinessGuard] })
export class BusinessModule {}
// truonglt Phase3 authenticated REST controllers end
