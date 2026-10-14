<!-- truonglt Phase4 read-only Render deployment owner handoff start -->
# Render hi?n c?: tiktok-6kwu

Code ?? chu?n b? cho authenticated READ; WRITE ri?ng m?c ??nh false. Kh?ng Swagger/OpenAPI UI. Dashboard trong phi?n c?ng c? redirect /login; kh?ng c? API key/deploy hook, n?n agent kh?ng t? c?u h?nh Environment ???c.

## Th? t? th?c hi?n

1. Ch? deploy commit Phase4 m?i tr?n main v?i Build `npm ci --include=dev && npm run build`, Start `npm run start:prod`, Root Directory tr?ng, Health `/api/v1/health/ready`. Kh?ng ch?y migration/import/seed trong build/start/predeploy.
2. File local `artifacts/phase4-render.env` ?? ch?a dedicated runtime credentials th?t, ignored v? ACL owner/SYSTEM. M? file tr?n m?y b?ng editor; nh?p v?o Environment c?a service hi?n c?, kh?ng d?n l?n chat/Git. File gi? BUSINESS_API_ENABLED=false ?? kh?ng m? writes khi revision c? c?n ho?t ??ng. DATABASE_URL trong file c?ng d?ng runtime role cho health; kh?ng ??a owner/import credentials l?n Render. DIRECT_URL kh?ng c?n cho validate/generate offline v? kh?ng d?ng ?? runtime business CRUD.
3. Secret File filename `supabase-ca.crt`, Contents l? to?n b? PEM CA ch?nh th?c local `apps/api/certs/prod-ca-2021.crt`, b?t ??u BEGIN CERTIFICATE/k?t th?c END CERTIFICATE. DATABASE_CA_CERT_PATH=/etc/secrets/supabase-ca.crt. Kh?ng ??a ???ng d?n v?o Contents.
4. Sau khi deployment m?i c? header X-Backend-Revision kh?p commit Phase4, ??t BUSINESS_API_ENABLED=true v? lu?n BUSINESS_WRITE_ENABLED=false, Save/redeploy. Startup ki?m tra runtime TLS/role th?t tr??c listen; sai config th? fail closed. Kh?ng b?t tr?n code Phase3 c? ch?a t?ch write flag.
5. CORS t?m ch?a b?t theo owner. B? tr?ng/kh?ng th?m CORS_ALLOWED_ORIGINS; khi c? URL Vercel, th?m exact origin HTTPS, kh?ng trailing slash/wildcard. React g?i kh?c domain c?n allowlist n?y tr??c khi t?ch h?p browser.
6. Agent/owner ch?y `npm run phase4:render-verify` v?i EXPECTED_RENDER_REVISION b?ng commit SHA m?i. Token th?t ch? ??c t? ignored artifacts/phase3-real-actor.jwt; n?u h?t h?n, ch?y script login-real-actor c?c b?, kh?ng g?i token/password l?n chat. Ki?m tra anonymous401, authenticatedGET200, POST403, health200, revision ??ng v? X-Business-Mode=read-only. Kh?ng claim deployment PASS tr??c b??c n?y.

| Variable | Value |
|---|---|
| NODE_VERSION | 24.21.0 |
| NODE_ENV | production |
| HOST | 0.0.0.0 |
| PORT | Render t? c?p, app ??c process.env.PORT |
| DB_ENVIRONMENT | DEV |
| BUSINESS_API_ENABLED | false khi staging credentials; true sau revision Phase4 x?c minh |
| BUSINESS_WRITE_ENABLED | false |
| DATABASE_URL | runtime URL th?t t? file local, health SELECT only |
| RUNTIME_DATABASE_URL | dedicated tiktok_api_runtime Session Pooler URL t? file local |
| DATABASE_CA_CERT_PATH | /etc/secrets/supabase-ca.crt |
| SUPABASE_URL | https://nqdaykgasfnsaixkhbya.supabase.co |
| SUPABASE_JWKS_URL | https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1/.well-known/jwks.json |
| CORS_ALLOWED_ORIGINS | b? tr?ng theo owner, c?u h?nh exact Vercel origin sau |

Kh?ng c?u h?nh IMPORT_DATABASE_URL/HISTORY_IMPORT_APPROVAL_PATH tr?n Render. Backend JWT verifier kh?ng c?n publishable/secret/service_role key. RENDER_GIT_COMMIT do Render c?p; d?ng header x?c minh revision theo [Render default environment variables](https://render.com/docs/environment-variables).
<!-- truonglt Phase4 read-only Render deployment owner handoff end -->
