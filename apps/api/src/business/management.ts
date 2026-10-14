// truonglt strict manual creation and private image validation start
import { createHash } from 'node:crypto';
import { fail, keys, object } from './contracts';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export function createProductDto(body: unknown) {
  const b = object(body); keys(b, ['name','note','pic']);
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 500) fail('INVALID_PRODUCT_NAME');
  for (const field of ['note','pic']) if (b[field] !== undefined && (typeof b[field] !== 'string' || (b[field] as string).length > 2000)) fail('INVALID_TEXT');
  return { name:b.name.trim(), note:String(b.note || '').trim(), pic:String(b.pic || '').trim() };
}
export function imageDto(body: unknown) {
  const b = object(body); keys(b, ['expectedVersion','filename','contentType','data']);
  if (!Number.isSafeInteger(b.expectedVersion) || Number(b.expectedVersion) < 1 || Number(b.expectedVersion) >= 2147483647) fail('INVALID_VERSION');
  if (typeof b.filename !== 'string' || !b.filename || b.filename.length > 200 || /[\r\n\0]/.test(b.filename)) fail('INVALID_IMAGE_NAME');
  if (typeof b.data !== 'string' || b.data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.data)) fail('IMAGE_SIZE_OR_FORMAT_INVALID');
  const bytes = Buffer.from(b.data, 'base64'); if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== b.data) fail('IMAGE_SIZE_OR_FORMAT_INVALID');
  const detected = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' :
    bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? 'image/jpeg' : bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP' ? 'image/webp' : null;
  if (!detected || b.contentType !== detected) fail('IMAGE_FORMAT_NOT_ALLOWED');
  return { expectedVersion:Number(b.expectedVersion), filename:b.filename, contentType:detected, data:b.data, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex') };
}
export function requestKey(key: string) { if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) fail('INVALID_IDEMPOTENCY_KEY'); return key; }
// truonglt strict manual creation and private image validation end
