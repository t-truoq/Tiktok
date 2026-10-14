// truonglt Phase3 fail-closed JWKS authorization start
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createPublicKey, verify } from 'node:crypto';
import { Actor, fail } from './contracts';
import { BusinessRepository } from './repository';
const PROJECT = 'nqdaykgasfnsaixkhbya';
export class JwtVerifier {
  private cache: { keys: any[]; expires: number } | null = null;
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly clock = () => Date.now()) {}
  async verify(token: string): Promise<string> {
    if (token.length > 16384) fail('INVALID_TOKEN', 401);
    const parts = token.split('.'); if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) fail('INVALID_TOKEN', 401);
    let header: any, payload: any;
    try { header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()); } catch { fail('INVALID_TOKEN', 401); }
    if (!header || !payload || !['RS256', 'ES256'].includes(header.alg) || typeof header.kid !== 'string' || header.crit || header.jku || header.jwk) fail('INVALID_TOKEN', 401);
    const issuer = `https://${PROJECT}.supabase.co/auth/v1`, now = Math.floor(this.clock() / 1000);
    if (payload.iss !== issuer || !(payload.aud === 'authenticated' || Array.isArray(payload.aud) && payload.aud.includes('authenticated')) ||
        typeof payload.sub !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sub) || !Number.isSafeInteger(payload.exp) || payload.exp <= now ||
        (payload.nbf !== undefined && (!Number.isSafeInteger(payload.nbf) || payload.nbf > now)) || payload.role !== 'authenticated') fail('INVALID_TOKEN', 401);
    if (!this.cache || this.cache.expires <= this.clock()) {
      try {
        const response = await this.fetcher(`${issuer}/.well-known/jwks.json`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
        if (!response.ok) throw Error(); const data = await response.json() as any;
        if (!Array.isArray(data.keys) || data.keys.length > 50) throw Error();
        this.cache = { keys: data.keys, expires: this.clock() + 60000 };
      } catch { fail('AUTH_KEYS_UNAVAILABLE', 503); }
    }
    const candidates = this.cache!.keys.filter(k => k.kid === header.kid && (!k.alg || k.alg === header.alg) && (!k.use || k.use === 'sig') &&
      (header.alg === 'RS256' ? k.kty === 'RSA' : k.kty === 'EC' && k.crv === 'P-256'));
    if (candidates.length !== 1) fail('INVALID_TOKEN', 401);
    try {
      const key = createPublicKey({ key: candidates[0], format: 'jwk' });
      if (!verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key, ...(header.alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}) }, Buffer.from(parts[2], 'base64url'))) fail('INVALID_TOKEN', 401);
    } catch { fail('INVALID_TOKEN', 401); }
    return payload.sub;
  }
}
@Injectable()
export class BusinessGuard implements CanActivate {
  private readonly jwt = new JwtVerifier();
  constructor(private readonly repository: BusinessRepository) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest(); const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !/^Bearer [^ ]+$/.test(auth)) fail('AUTH_REQUIRED', 401);
    const subject = await this.jwt.verify(auth.slice(7));
    const actor = await this.repository.actor(subject); if (!actor) fail('ACTOR_NOT_PROVISIONED', 403);
    if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(actor.role)) fail('FORBIDDEN', 403);
    if (!['GET', 'HEAD'].includes(req.method) && actor.role === 'VIEWER') fail('FORBIDDEN', 403);
    req.actor = Object.freeze({ id: actor.id, role: actor.role, subject } satisfies Actor); return true;
  }
}
// truonglt Phase3 fail-closed JWKS authorization end
