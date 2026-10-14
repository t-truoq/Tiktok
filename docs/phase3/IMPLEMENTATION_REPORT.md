<!-- truonglt Phase3.1 final verification start -->
# Phase 3.1 ? PASS trong ph?m vi owner ?? ch?t

Ng?y 14/10/2026. Scope: business logic cho root hi?n c?; owner defer create/rename/archive. Backend, runtime security v? real ADMIN E2E ?? ki?m ch?ng. Public Business API v?n disabled, ch?a import HISTORY v? ch?a l?m Frontend/Phase4. B?o c?o ban ??u ???c gi? t?i INITIAL_IMPLEMENTATION_REPORT.md; k?t qu? c? m? t? th?i ?i?m tr??c tri?n khai b?o m?t.

## Tri?n khai th?c t?

- Finance engine d?ng Decimal, dynamic rounds, ledger paid/unpaid, incurred/End costs, refund eligibility, projected profit, verification/missing-price metadata. Kh?ng t?o cash refund rule t? refundQty; refund v? image metadata read-only, PIC reference c? mutation theo source.
- Timezone owner x?c nh?n Asia/Ho_Chi_Minh: parser d?ng IANA/Intl t?p trung, clock injection, ki?m th? 24h/15d/30d v? calendar rollover. PostgreSQL l?u instant UTC; raw HISTORY timestamp kh?ng s?a. Kh?ng c?n SOURCE_TIMEZONE_REQUIRED cho ??nh d?ng ngu?n h?p l?; invalid/ambiguous input l?i r? r?ng.
- Controllers/DTO/services/repositories: listing/detail/filter/pagination, source stage/buy/sales/field/verify/cancel/restore actions, version CAS, idempotency hash/outcome, audit actor, immutable history/snapshots, transaction Serializable v? conflict409. JSON Decimal/BIGINT d?ng string. Grouped edits ch?y theo th? t? c?t ngu?n, l?u intermediate audit states.
- Full onEdit/header harness ch?y source V9.1 v? V9.2 v?i in-memory Sheets/storage, clock r? r?ng. ??i chi?u enter/leave, N3, received/cancellation/header sync, AUTO_STATUS, sales v? Done snapshots. Snapshot profit quan s?t tr??c t?nh l?i ???c gi? ri?ng v?i derived finance; cached source profit v? displayed profit kh?ng b? t? ??ng nh?t. ??y l? reference harness, kh?ng ph?i ki?m th? ghi Google Sheets th?t ho?c m?i UI side effect.
- AppModule ch? ??ng k? BusinessModule khi BUSINESS_API_ENABLED=true; khi false GET/POST business tr?404, health v?n ho?t ??ng. Runtime kh?ng fallback owner DATABASE_URL.

## Database security ?? APPLIED

Migration m?i: `apps/api/prisma/migrations/20261014083000_runtime_security/migration.sql`.
SHA256: `3916a0baca77cd2be19531165d24315d251aae732b54df3437a7a13e561f3a0b`.
Prisma7 migrate deploy ch?y m?t l?n, TLS strict + CA; migration Phase2 kh?ng s?a. Catalog th?c t? x?c nh?n hai migration finished, 13 business tables/RLS, 22 policies v? 10 immutable triggers; columns/constraints/FKs/indexes c?a Phase2 kh?ng ??i. auth/storage kh?ng s?a.

Dedicated NOLOGIN privilege role tiktok_api_access v? LOGIN tiktok_api_runtime: NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB, kh?ng owner/DDL/DELETE/TRUNCATE, membership INHERIT nh?ng SET/ADMIN=false. LOGIN secret sinh ng?u nhi?n, l?u ignored local files v?i ACL owner/SYSTEM; kh?ng ghi Git/log. Runtime kh?ng s?a users/import archives/legacy raw/source history. Source archive ch? ??c metadata columns. Xem SECURITY_MODEL.md v? trust boundary c?a custom GUC.

Owner-authorized Auth UUID c918885f-c09c-40b0-a43a-4edcbdf69317 ???c ki?m tra t?n t?i v? provision ??ng ADMIN v?o public.users; kh?ng t?o Auth user. JWT th?t ki?m tra signature qua JWKS, issuer/audience/time/identity. ADMIN ???c ??c/ghi synthetic fixture; actor audit kh?p JWT. users hi?n c? ??ng m?t authorized row; 12 b?ng nghi?p v? kh?c kh?ng c? d? li?u. HISTORY ch?a import.

## B?ng ch?ng nghi?m thu

| Ki?m th? | K?t qu? |
|---|---|
| npm ci --include=dev, Prisma validate/generate, TypeScript build | PASS, Node24.21.0 / Prisma7.10.0 |
| Backend Node tests | 100 PASS |
| Phase0/2 preservation Node tests | 104 PASS |
| Python independent tests | 14 PASS; Decimal math ki?m tra tr?n normalized projection, kh?ng claim independent normalization |
| Financial parity V9.1/V9.2 | 46/46 records, t?ng round; PARITY_RESULT.json |
| Runtime catalogs/grants/RLS allowed-denied/context isolation | 21 PASS; RLS_LIVE_RESULT.json |
| Real ADMIN JWT qua HTTP/runtime Prisma/RLS | 11 PASS; REAL_ACTOR_E2E_RESULT.json |
| Multi-session PostgreSQL conflict/replay/idempotency | 3 PASS; CONCURRENCY_LIVE_RESULT.json |
| Actual production repository role/actor/transaction checks | PASS; PRODUCTION_REPOSITORY_RESULT.json |
| Local compiled production startup | PASS, 0.0.0.0/process.env.PORT, live200 |
| Local real DEV live/ready | HTTP200/200, verified TLS1.3 client?pooler, UTC |
| Dependency audit full + omit=dev | 0 vulnerabilities; DEPENDENCY_AUDIT.json |
| GitHub Actions | BLOCKED_BY_BILLING; CLI exception do owner ph? duy?t |

C?c mutation HTTP ch?y trong outer transaction rollback v? savepoints. Multi-session tests c?n committed synthetic metadata ?? hai sessions nh?n th?y, nh?ng kh?ng commit financial/history events; cleanup DELETE ch? exact generated UUID/prefix/request c?a fixture, counts kh?i ph?c. RLS role variants tr?n real user ???c thay ??i trong transaction rollback, ADMIN restored. Real VIEWER token ch?a c?: HTTP viewer denial d?ng unit synthetic JWT, DB denial d?ng real PostgreSQL; kh?ng claim real VIEWER E2E.

Baseline active24: paid144155159, unpaid25352082, refund eligible53288699, projected profit33059918 VND. Engine kh?ng hardcode totals. Ngu?n v?n 46 records/1224 events/133 snapshots/24 active+22 legacy, SHA256 b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db. Missing prices/unverified/conflict findings gi? nguy?n trong Phase0 validation, kh?ng repair.

Source d?ng Number, engine d?ng Decimal theo y?u c?u: synthetic 0.1*0.2 tr?0.02 thay binary artifact; kh?ng c? discrepancy tr?n ngu?n46. Sales th?c t? theo End slot d? tooltip ngu?n n?i Sample. Kh?ng ??i logic ?? s?a quirks received reset/reactivate t?i priced ??t c?a header sync.

## Ph?m vi ch?a b?t

Kh?ng public writes, import, storage upload/cash-refund CRUD, create/rename/archive ho?c Frontend. Owner ?? defer identity operations; read-only metadata kh?ng suy ra nghi?p v? ch?a c?. Render health deployment ???c ki?m tra ri?ng; kh?ng suy ra revision/build Phase3 ch? t? HTTP200. B?t public Business API c?n ph? duy?t ri?ng v? c?u h?nh runtime secret an to?n tr?n Render. Gate3 PASS ch? cho scope backend/security hi?n c?; kh?ng thay th? import/release acceptance ho?c backup restore rehearsal.
<!-- truonglt Phase3.1 final verification end -->
