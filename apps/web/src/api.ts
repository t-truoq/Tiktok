// truonglt Phase5 authenticated REST transport; no browser financial arithmetic start
import { createClient } from '@supabase/supabase-js';
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const auth = supabaseUrl && publishable && !publishable.includes('YOUR_') ? createClient(supabaseUrl, publishable) : null;
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export class ApiError extends Error { constructor(public code: string, public status: number) { super(errorText(code)); } }
export function errorText(code: string) {
  const messages: Record<string,string> = { AUTH_REQUIRED: 'Vui lòng đăng nhập để tiếp tục.', INVALID_TOKEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    FORBIDDEN: 'Tài khoản chưa có quyền thực hiện thao tác này.', ACTOR_NOT_PROVISIONED: 'Tài khoản chưa được cấp quyền trong hệ thống.',
    VERSION_CONFLICT: 'Sản phẩm vừa được cập nhật ở nơi khác. Tải lại dữ liệu trước khi lưu.', IDEMPOTENCY_CONFLICT: 'Yêu cầu lưu bị trùng với nội dung khác.',
    BUSINESS_WRITES_DISABLED: 'Hệ thống đang ở chế độ chỉ đọc.', ARCHIVAL_RECORD_READ_ONLY: 'Dữ liệu legacy hoặc đã lưu trữ chỉ được xem.',
    BUY_REQUIRES_ORDER_STAGE: 'Chỉ sửa giá mua tại giai đoạn Đặt.', SALES_REQUIRES_END_STAGE: 'Chỉ sửa giá bán ở giai đoạn End.',
    DECIMAL_NOT_REPRESENTABLE: 'Giá trị vượt độ chính xác cho phép. Tiền tối đa 2 chữ số thập phân, số lượng tối đa 3.',
    INVALID_MONEY: 'Giá trị tiền chưa hợp lệ.', INVALID_SOURCE_DATE: 'Ngày giờ chưa hợp lệ.', BUSINESS_DATABASE_UNAVAILABLE: 'Chưa thể kết nối dữ liệu. Hãy thử lại.',
    AUTH_KEYS_UNAVAILABLE: 'Đăng nhập tạm thời chưa sẵn sàng.', UNSAFE_RUNTIME_ROLE: 'Kết nối chưa được quản trị viên cấu hình đúng.' };
  return messages[code] || 'Không thể hoàn tất yêu cầu. Dữ liệu cũ vẫn được giữ nguyên.';
}
export async function api<T>(path: string, options: { method?: string; body?: unknown; key?: string; signal?: AbortSignal } = {}): Promise<T> {
  if (!auth) throw new ApiError('AUTH_REQUIRED',401);
  const { data } = await auth.auth.getSession(); if (!data.session) throw new ApiError('AUTH_REQUIRED',401);
  let response: Response;
  try { response = await fetch(base + '/api/v1' + path, { method: options.method || 'GET', cache: 'no-store',
    signal: options.signal || AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + data.session.access_token,
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(options.key ? { 'Idempotency-Key': options.key } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  } catch { throw new ApiError('BUSINESS_DATABASE_UNAVAILABLE',503); }
  let body: any; try { body = await response.json(); } catch { throw new ApiError('BUSINESS_DATABASE_UNAVAILABLE',503); }
  if (!response.ok) throw new ApiError(body.code || 'REQUEST_FAILED',response.status); return body;
}
export function qs(values: Record<string,unknown>) { const p = new URLSearchParams(); for (const [k,v] of Object.entries(values)) if(v!==undefined&&v!==null&&v!=='') p.set(k,String(v)); return p.size?'?'+p.toString():''; }
export type Scope = '' | 'XLSX_MATCHED' | 'LEGACY_UNMATCHED';
export type Finance = { payment: { paid: string; unpaid: string; incurred: string; sampleTotal: string; endTotal: string; missing: number; review: number;
  details: { key:string;label:string;amount:string|null;bucket:string;verified:boolean;issue:string;received:boolean;ordered:boolean }[] }; refund: {total:string;missing:number}; projectedProfit:string;endRevenue:string;endQuantity:string };
export type Round = { id:string;group:'SAMPLE'|'END';roundIndex:string;ordered:boolean|null;received:boolean|null;cancelled:boolean|null;verified:boolean|null;issue:string|null;orderPrice:string|null;orderPriceState:string;
  sales?: {unitPrice:string|null;soldQuantity:string|null;unitPriceState:string;quantityState:string}|null };
export type Product = { id:string;rootName:string;classification:'XLSX_MATCHED'|'LEGACY_UNMATCHED';currentStageLabel:string|null;currentStageIndex:string|null;currentStatus:string|null;currentDateText:string|null;
  note:string|null;pic:string|null;wholesale:string|null;sampleSalesQuantity:string|null;refundQuantity:string|null;version:number;archived:boolean;rounds?:Round[];finance:Finance;
  computedStatus?:string;attention?:{missingPrices:number;unverified:number;refundDue:boolean;historyConflict:boolean;dateIssue:string|null};
  sourceView?:{sampleBuy:unknown;endBuy:unknown;wholesale:unknown;qty:unknown;refundQty:unknown;endSell:unknown;endSellQty:unknown;imageReference?:unknown} };
export type Page<T> = { page:number;limit:number;total:number;items:T[] };
export type Summary = { count:number;missing:number;review:number;paid:string;unpaid:string;incurred:string;sampleTotal:string;endTotal:string;refundEligible:string;projectedProfit:string };
export type Capabilities = { actor:{id:string;role:'ADMIN'|'EDITOR'|'VIEWER';subject:string};timezone:string;canWrite:boolean;writeEnabled:boolean };
export type History = { id:string;eventType:string;stageLabel:string|null;sourceTimestampText:string|null;occurredAtUtc:string|null;originalPayload:any;beforeJson:any;afterJson:any;actorId:string|null;reason:string|null;legacyEventIndex:number|null };
export type Snapshot = { id:string;sourceLabel:string;sourceDateText:string|null;snapshot:any;sourceJsonPointer:string|null };
export type Mutation = { expectedVersion:number;operation:string;values:Record<string,unknown>;reason?:string };
export type Preview = { expectedVersion:number;beforeFinance:Finance;afterFinance:Finance;stage:string;eventTypes:string[];writesExecuted:false };
// Exact string formatting only: never parse currency into binary floating point or compute a total.
export function decimalText(value: unknown, currency=false) {
  if(value===null||value===undefined||value==='')return '—';const raw=String(value);if(!/^-?\d+(\.\d+)?$/.test(raw))return 'Chưa rõ';
  const [integer,fraction] = raw.split('.');const decimals=fraction?.replace(/0+$/,'');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + (decimals?','+decimals:'') + (currency?' ₫':'');
}
export const money = (value:unknown)=>decimalText(value,true);
export const stageLabel = (value:string|null)=>value||'Chưa chọn giai đoạn';
// truonglt Phase5 authenticated REST transport; no browser financial arithmetic end
