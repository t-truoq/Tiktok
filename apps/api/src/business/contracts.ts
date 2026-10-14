// truonglt Phase3 strict business DTO contracts start
import { HttpException } from '@nestjs/common';
export function fail(code: string, status = 400): never { throw new HttpException({ code }, status); }
export type Actor = { id: string; role: 'ADMIN' | 'EDITOR' | 'VIEWER'; subject: string };
export type Operation = 'SET_STAGE' | 'EDIT_BUY' | 'EDIT_SALES' | 'EDIT_FIELDS' | 'VERIFY_STAGE' | 'CORRECT_UNRECEIVED' | 'CANCEL_STAGE' | 'RESTORE_STAGE';
export type MutationDto = { expectedVersion: number; operation: Operation; values: { [key: string]: unknown }; reason?: string };
const operations: Operation[] = ['SET_STAGE', 'EDIT_BUY', 'EDIT_SALES', 'EDIT_FIELDS', 'VERIFY_STAGE', 'CORRECT_UNRECEIVED', 'CANCEL_STAGE', 'RESTORE_STAGE'];
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_DTO');
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) fail('INVALID_DTO');
  return obj;
}
export function keys(value: Record<string, unknown>, allowed: string[]) { if (Object.keys(value).some(k => !allowed.includes(k))) fail('UNKNOWN_FIELD'); }
export function mutationDto(value: unknown): MutationDto {
  const dto = object(value); keys(dto, ['expectedVersion', 'operation', 'values', 'reason']);
  if (!Number.isSafeInteger(dto.expectedVersion) || Number(dto.expectedVersion) < 1 || Number(dto.expectedVersion) >= 2147483647) fail('INVALID_VERSION');
  if (!operations.includes(dto.operation as Operation)) fail('INVALID_OPERATION');
  if (dto.reason !== undefined && (typeof dto.reason !== 'string' || dto.reason.length > 1000)) fail('INVALID_REASON');
  return { expectedVersion: dto.expectedVersion as number, operation: dto.operation as Operation, values: object(dto.values), reason: dto.reason as string | undefined };
}
export function uuid(value: string) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail('INVALID_ID'); return value; }
export function pagination(query: Record<string, unknown>) {
  // truonglt Phase5 exact source stage filter start
  keys(query, ['page', 'limit', 'sort', 'direction', 'status', 'stage', 'classification', 'archived', 'search']);
  // truonglt Phase5 exact source stage filter end
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? 25);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('INVALID_PAGINATION');
  const sort = String(query.sort ?? 'rootName'); if (!['rootName', 'createdAt', 'updatedAt', 'currentStatus'].includes(sort)) fail('INVALID_SORT');
  const direction = String(query.direction ?? 'asc'); if (!['asc', 'desc'].includes(direction)) fail('INVALID_SORT');
  if (query.classification !== undefined && !['XLSX_MATCHED', 'LEGACY_UNMATCHED'].includes(String(query.classification))) fail('INVALID_CLASSIFICATION');
  if (query.archived !== undefined && !['true', 'false'].includes(String(query.archived))) fail('INVALID_ARCHIVED');
  // truonglt Phase5 validate stage label without silently normalizing a filter start
  for (const key of ['status', 'stage', 'search']) if (query[key] !== undefined && (typeof query[key] !== 'string' || (query[key] as string).length > 200)) fail('INVALID_FILTER');
  // truonglt Phase5 validate stage label without silently normalizing a filter end
  return { skip: (page - 1) * limit, take: limit, page, orderBy: [{ [sort]: direction }, { id: 'asc' }], where: {
    ...(query.status !== undefined ? { currentStatus: query.status } : {}), ...(query.classification ? { classification: query.classification } : {}),
    // truonglt Phase5 parameterized source stage selection start
    ...(query.stage !== undefined ? { currentStageLabel: query.stage } : {}),
    // truonglt Phase5 parameterized source stage selection end
    ...(query.archived !== undefined ? { archived: query.archived === 'true' } : {}),
    ...(query.search ? { rootName: { contains: query.search, mode: 'insensitive' } } : {}) } };
}
// truonglt Phase3 strict business DTO contracts end
