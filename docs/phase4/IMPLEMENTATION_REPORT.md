<!-- truonglt Phase4 implementation and evidence start -->
# Phase4 ? importer/dry-run PASS; Render READ activation pending

Source HISTORY SHA256 b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db verified tr??c/sau, kh?ng import DEV. Kh?ng migration, kh?ng Google Sheets writes, kh?ng Frontend ho?c Swagger dependency/UI.

## Code th?c t?

- scripts/phase4/importer.cjs: parser d?ng preservation decoder ?? nghi?m thu, b?n nguy?n g?c archive byte-for-byte, manifests/chunks v? decoded JSON text/hash. Mapping 13 Prisma models, 46 products/legacy, 1224 event rows gi? index/payload/source timestamp,133 snapshots,71 properties. 24 matched/22 legacy; source value types/legacyValues ph?n bi?t missing/SQLNULL, JSONnull,blank,zero, numeric text; dynamic rounds, unverified/issue gi? nguy?n. users v? mutation_requests c?0 source rows, kh?ng t?o fake actor/idempotency requests t? history.
- Financial projection d?ng Phase3 normalize/Decimal engine V9.1, ch?a ghi raw. M?i record/round ??i chi?u oracle v? hydration qua business service; l?i hydrate oracle envelope ???c s?a t??ng th?ch c? normalizedCopy v? direct record. 80 round projections,31 End sales; derived refund eligibility metadata46, source images/PIC metadata46. Kh?ng suy ra actual cash refund/storage upload.
- Transactional Prisma writer: single Serializable transaction, advisory transaction lock + unique batch/source identity, stable IDs, no skipDuplicates/upsert repair. Replay ki?m tra plan checksum/status v? database round-trip, kh?ng ghi ?? existing source/product. Batch/status/archive v? m?i child writes atomic; failure rollback, kh?ng destructive recovery/retry. N?u products ?? c? tr??c import m?i, d?ng owner review. users/auth/storage kh?ng thay ??i.
- history-import.cjs: default dry-run, kh?ng instantiate database client. --apply c?n ri?ng owner approval file ??ng scope/project/sourceSHA/planSHA v? IMPORT_DATABASE_URL explicit; kh?ng fallback runtime/health. Import future rechecks migrations/UTC, TLS verified v?i CA, round-trip all columns/payloads/counts v? finance trong transaction tr??c commit. Kh?ng ch?y --apply trong Phase4 n?y; th?c thi importer tr?n PostgreSQL th?t v?n NOT_EXECUTED_UNAPPROVED, offline memory tests kh?ng thay th? live import evidence.
- REST /api/v1: authenticated reads, sales v? stages aliases th?m v?o existing controller/service; BUSINESS_WRITE_ENABLED ??c l?p m?c ??nh false. ADMIN c?ng b?403 khi public writes disabled. Eager runtime role/TLS verification tr??c listen. Headers X-Backend-Revision v? X-Business-Mode ph?c v? deployment evidence; body health v?n gi? nguy?n. CORS ch?a b?t theo owner, allowlist exact origin c? s?n khi cung c?p URL Vercel.

## Verification

Prisma validate/generate v? npm build PASS. Finance parity46/46/per-round c? V9.1/V9.2; active24 paid144155159, unpaid25352082, refundEligible53288699, projectedProfit33059918 VND, kh?ng hardcode trong implementation. DRY_RUN_RESULT.json ghi count/checksum v? source findings: missing price11, unverified69 + inactive2, conflict1; kh?ng repair. Date mapping findings0.

Importer tests6 PASS: byte/raw JSON restoration, checksum/tamper rejection, Decimal/null/blank/missing/BIGINT/dynamic rounds, hydrate oracle shape, transaction replay/duplicate preservation, injected rollback. Writer tests d?ng in-memory Prisma seam v?i source th?t ch? trong RAM; tuy?t ??i kh?ng g?i HISTORY v?o DEV k? c? rollback. Read-only resource HTTP unit1 PASS d?ng synthetic JWT/DB seam; kh?ng claim real E2E. Backend suite107 tests PASS (100 prior +6 importer +1 new read API); preservation104/Python14 PASS.

LOCAL_READ_API_RESULT.json l? real ADMIN JWT qua production createApp + actual runtime Prisma/RLS: health200, anonymous401, authenticated products/summary/metadata200, nonexistent product/resources404, ADMIN POST403. Kh?ng c? source rows n?n kh?ng claim real detail response cho imported product; detail/sales/stages payload200 ki?m tra b?ng unit fixture. DB_READONLY_RESULT.json x?c nh?n runtime role/verifiedTLS/UTC, users1 authorizedADMIN,12 b?ng kh?c0, read-only transaction.

## Deployment status v? owner step

Dashboard c?ng c? chuy?n t?i login, kh?ng c? Render API key/deploy hook. Ch?a th? c?p nh?t runtime Environment ho?c ??c build logs. Source s? commit/push main sau core checks; auto-deploy n?u service gi? On Commit. Kh?ng suy ra deployed revision t? health200. Xem OWNER_RENDER_SETUP.md v? file local ignored ACL artifacts/phase4-render.env: credentials staged v?i API=false; ch? b?t true sau revision Phase4 ???c header x?c minh, lu?n WRITE=false. Token th?t kh?ng g?i chat/Git. Sau activation, verify-read-api --render ki?m tra realJWT/HTTP/revision/read-only; deployment ch? PASS khi ??t.

Committed-import recovery is not automatic: immutable source history cannot be deleted/rewritten; future real import requires separately approved backup/restore handling. Current rollback means transaction failure before commit.

Gate4 importer/offline integration PASS; to?n b? Phase4 PARTIAL n?u Render activation ch?a ???c ki?m ch?ng. Actual data import v?n UNAPPROVED/NOT_EXECUTED. Kh?ng y?u c?u approval import trong l??t n?y.
<!-- truonglt Phase4 implementation and evidence end -->
