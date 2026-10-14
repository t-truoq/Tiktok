// truonglt Phase3.1 owner-confirmed IANA source timezone start
export const SOURCE_TIMEZONE = 'Asia/Ho_Chi_Minh';
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TIMEZONE, calendar: 'iso8601', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function parts(date: Date) {
  return Object.fromEntries(formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export class SourceDateError extends Error {
  constructor(readonly code: 'INVALID_SOURCE_DATE' | 'AMBIGUOUS_SOURCE_DATE') { super(code); }
}
export function sourceDateToInstant(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) { if (!Number.isFinite(value.getTime())) throw new SourceDateError('INVALID_SOURCE_DATE'); return new Date(value); }
  if (typeof value !== 'string') throw new SourceDateError('INVALID_SOURCE_DATE');
  const explicit = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  // Explicit offset inputs also undergo calendar validation, avoiding JS date rollover.
  const calendar = explicit ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/.exec(value) : match;
  if (!calendar) throw new SourceDateError('INVALID_SOURCE_DATE');
  const [y, m, d, h, min, s] = [calendar[1], calendar[2], calendar[3], calendar[4] || 0, calendar[5] || 0, calendar[6] || 0].map(Number);
  const ms = Number((calendar[7] || '').padEnd(3, '0'));
  const wall = Date.UTC(y, m - 1, d, h, min, s, ms), check = new Date(wall);
  if (y < 1000 || check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d ||
      check.getUTCHours() !== h || check.getUTCMinutes() !== min || check.getUTCSeconds() !== s) throw new SourceDateError('INVALID_SOURCE_DATE');
  if (explicit) { const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) throw new SourceDateError('INVALID_SOURCE_DATE'); return parsed; }
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const instant = new Date(wall + delta), p = parts(instant);
    offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000);
  }
  const candidates = [...offsets].map(offset => wall - offset).filter(time => {
    const p = parts(new Date(time)); return p.year === y && p.month === m && p.day === d && p.hour === h && p.minute === min && p.second === s;
  });
  if (candidates.length !== 1) throw new SourceDateError(candidates.length ? 'AMBIGUOUS_SOURCE_DATE' : 'INVALID_SOURCE_DATE');
  return new Date(candidates[0]);
}
export function formatSourceTimestamp(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new SourceDateError('INVALID_SOURCE_DATE');
  const p = parts(date), pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}
// truonglt Phase3.1 owner-confirmed IANA source timezone end
