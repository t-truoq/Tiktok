# TikTok Affiliate — Implementation Blueprint for Codex (GPT-6.1 Sol Light)

<!-- truonglt owner source decision start -->
## Quyết định nguồn dữ liệu của owner — 14/10/2026

Phần này ưu tiên hơn các yêu cầu lấy lại Google Sheets/Document Properties ở các phần cũ bên dưới.

- Source of Truth là nguyên bản `TikTok_Affiliate_Phase0_References/references/TikTok_Affiliate_HISTORY_20261014_104638.json`, SHA-256 `b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db`. Không yêu cầu export lại Google Sheets để xác nhận nguồn này.
- Phạm vi migration baseline: toàn bộ **46 product root records**, không phải metadata productCount=70 (có cả chunk). Phân loại **24 XLSX_MATCHED** và **22 LEGACY_UNMATCHED** chỉ để trình bày/đối chiếu; không xóa, gộp, rename, tự archive hoặc sửa record nào.
- Giữ nguyên decoded JSON text, nguyên bản file nguồn và các manifest/chunk; bảo toàn mọi history event, stageData, purchaseState, price/sales slot, image/status, trạng thái verified, local date text và kiểu missing/null/blank/zero. Không fabricate actor hoặc UTC cho lịch sử chưa có timezone.
- Thuật toán V9.1 là oracle chuẩn; so sánh V9.2 trên cả 46 record. V9.1 ensureRecord chỉ được chạy trên bản sao để tạo projection tính toán; không dùng normalized copy ghi đè raw source, đặc biệt với 22 record legacy.
- Gate0 theo quyết định mới: checksum nguồn pinned và fixture checksums đạt; đủ 46 record/71 properties được account; bảo toàn raw values/types/history/state/snapshots; golden per-product/per-round V9.1 bằng V9.2; validation độc lập decode/types và Decimal math đạt; toàn bộ missing-price/unverified/history conflicts có báo cáo. Những vấn đề đã tồn tại trong source được giữ làm findings, không sửa để đạt gate. Mismatch do mất dữ liệu/đổi kiểu/tính sai vẫn chặn gate.
- Owner xác nhận project `nqdaykgasfnsaixkhbya` là DEV; không yêu cầu project DEV mới. Gate1 local connectivity/health đã đạt; staging và CI thực tế vẫn cần nghiệm thu.
- Sau Gate0, được chuẩn bị proposal Prisma schema, mapping và SQL preview Phase2 hoàn toàn offline. Không áp dụng migration/DDL/import Supabase cho đến khi các gate bắt buộc đạt và có phê duyệt riêng cho hành động cụ thể. Việc chấp nhận source không phải phê duyệt import.

Baseline canonical: `tests/golden/baseline-input.json`, `baseline-expected.json`. XLSX chỉ là tham chiếu phân loại: `xlsx-observed-input.json`, `xlsx-observed-expected.json`. Báo cáo Gate0: `docs/GATE0_SIGNOFF.md`; findings đầy đủ: `docs/phase0/SOURCE_BASELINE_VALIDATION.json`.
<!-- truonglt owner source decision end -->

> **Purpose:** Rebuild the existing Google Sheets + Apps Script V9.1/V9.2 TikTok Affiliate workflow as a responsive, friendly web application. **Database-first, backend-entities-second, frontend-tables-third.** Preserve every verified financial rule, existing record and audit history. This is an implementation contract, not permission to invent business rules.
>
> **Reference source files (must be provided to Codex):** `Tiktok_Affiliate_V9.1_Original_Backup.gs`, `Tiktok_Affiliate_V9.2_Optimized.gs`, `Pasted text(20261014-015629).txt`, `Tiktok affiliate.xlsx`. The Excel snapshot DOES NOT include all Apps Script Document Properties. Never claim a complete migration from Excel alone.

## 0. Mandatory working rules for Codex

1. Work incrementally; make **small reviewable commits** and run tests at the end of each phase. Do not create UI until DB connection and entities work.
2. Keep original spreadsheet and Apps Script active and **read-only as reference during development**. Do not erase, migrate-in-place, rename or overwrite existing Google Sheet data/Properties. Never automatically run legacy `setupAffiliateAutomation`, `repairAffiliateFinancialData`, or any destructive repair action.
3. **Do not change arithmetic or stage rules to make tests pass.** Port behavior from authoritative JS implementations; document ambiguities and compare with golden fixtures. Do not guess missing records, dates, prices or payment statuses.
4. All changed/added code blocks must use comments `truonglt ... start` and `truonglt ... end` where language syntax supports comments. Keep code readable; do not overcompress it.
5. Vietnamese is the primary interface language. User-facing errors must identify the product, stage, and corrective action without leaking server secrets.
6. Monetary values: PostgreSQL `numeric(18,2)` (or a precision agreed from source data); TypeScript uses a decimal library such as `decimal.js` or an exact integer minor-unit representation. **Do not calculate currency with JS floating-point.** Preserve precision from source; do not round silently. Quantity precision/scale to be established from fixtures (e.g. numeric(18,3) initially, adjusted if needed).
7. Use server-side validation, DB constraints, transactions, row-level versioning/idempotency; never trust FE calculations as the source of truth.
8. Make every financial change auditable (before/after, actor, timestamp, reason, request ID), retain historical stage snapshots, and provide export/restore tools.
9. Every API, rule, schema and UI action needs tests, including error paths, concurrent edits and migrations.
10. Stop a phase if mandatory reconciliation fails; surface a detailed mismatch report rather than silently modifying values.

## 1. User goals & non-goals

**Goals:** Fast edits even with many products; responsive desktop/mobile; intuitive Sheets-like grid; accurate Sample/End stage purchase, paid/unpaid, refund eligibility, projected profit; complete per-product history and image management; centralized cloud DB; easy deploy; import/export and reconciliation.

**Non-goals (initial release):** TikTok API integration, automated payouts, sales marketplace scraping, multi-currency accounting, accounting integrations, arbitrarily changing the existing financial formulas.

## 2. Chosen stack & deployment

- **Cloud DB:** Managed PostgreSQL on Supabase, with separate DEV and PROD projects. Supabase manages DB server. Enable backups suitable for tier, check free-tier project pause/limits.
- **Backend:** Node.js LTS, TypeScript, NestJS, Prisma ORM/migrations, REST API `/api/v1`; class-validator/Zod, Decimal.js, OpenAPI/Swagger, pino structured logs.
- **Frontend:** React + TypeScript + Vite + Ant Design (Vietnamese locale), TanStack Query, TanStack Table or Ant Design Table with virtualization as needed, React Router, Zod + React Hook Form, dayjs.
- **Authentication:** Supabase Auth; BE verifies JWT server-side, maps auth subject to app role. BE exclusively performs sensitive financial mutations. No service role key / DB password on FE. Enable RLS for direct Supabase data paths or deny all direct client table access; **only one authoritative write path: BE API**.
- **Image storage:** Supabase Storage bucket; private by default, controlled signed URLs and MIME/file-size checks.
- **Hosting:** FE on Vercel; NestJS BE on Render/Railway/Fly (persistent Node runtime); managed Supabase DB stays on cloud independently. Health checks, environment-variable management, separate deployment pipeline.
- **Database access:** Prisma runtime connection uses pooled Supabase connection string where supported; schema migration uses direct migration URL. Verify provider's actual current connection instructions in dashboard, do not guess port or parameters.
- **Monorepo suggested:** `apps/web`, `apps/api`, `packages/shared`, `packages/finance-engine`, `prisma/` (or `apps/api/prisma`), `scripts/migration`, `docs/`, `tests/golden/`.

## 2A. Supabase project configuration supplied by owner (sanitized)

**Project reference:** `nqdaykgasfnsaixkhbya`  
**API base URL:** `https://nqdaykgasfnsaixkhbya.supabase.co`  
**JWKS endpoint:** `https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1/.well-known/jwks.json`  
**Direct PostgreSQL hostname:** `db.nqdaykgasfnsaixkhbya.supabase.co`  
**Direct PostgreSQL port:** `5432`  
**Database:** `postgres`  
**Direct connection username:** `postgres`.

**SECURITY GATE — BEFORE DEPLOYMENT:** A Supabase secret API key was pasted into an earlier chat. Treat that secret as exposed. Owner must rotate/revoke it in Supabase Dashboard and replace it in secure backend environment variables. Never quote it, commit it, echo it in logs, put it into markdown, or use it for development. A `sb_publishable_...` key is intended for public/client use, but do not paste the actual key into this plan; copy it locally from Supabase Dashboard. Database password has **not** been provided. Never ask the owner to paste database passwords or secret keys into chats.

```dotenv
# apps/api/.env (local only; do NOT commit)
# truonglt supabase env start
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:<DB_PASSWORD>@db.nqdaykgasfnsaixkhbya.supabase.co:5432/postgres?sslmode=require"
# Choose the actual migration-capable URL returned in Supabase Connect.
# Do not assume DIRECT_URL equals the pooled runtime URL.
DIRECT_URL="<SUPABASE_MIGRATION_CONNECTION_URI>"
SUPABASE_URL="https://nqdaykgasfnsaixkhbya.supabase.co"
SUPABASE_JWKS_URL="https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1/.well-known/jwks.json"
SUPABASE_PUBLISHABLE_KEY="<COPY_FROM_DASHBOARD>"
SUPABASE_SECRET_KEY="<NEWLY_ROTATED_SECRET_IF_REQUIRED_SERVER_SIDE>"
# truonglt supabase env end
```

```dotenv
# apps/web/.env.local (public build-time values ONLY)
# truonglt frontend env start
VITE_API_BASE_URL="http://localhost:3000/api/v1"
VITE_SUPABASE_URL="https://nqdaykgasfnsaixkhbya.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<COPY_FROM_DASHBOARD>"
# truonglt frontend env end
```

**Connection details:** The supplied `db.*:5432` URI is a **direct** database connection and may be unreachable on networks without outbound IPv6 support. When that happens, open Supabase Dashboard → **Connect** and copy the **Session Pooler** URI provided by Supabase; never invent pooler hostnames, username, port or SSL parameters. Check Prisma version-specific pooler/migration instructions. For any database passwords containing special URL characters, URL-encode the password component. `.env`, `.env.local`, certificates and credentials must be ignored by Git. Keep `.env.example` with placeholders only.

**Owner's desired sequence:** (1) verify live DB connectivity with harmless `SELECT 1`; (2) model Prisma entities and apply reviewed migrations to DEV; (3) implement authoritative finance/workflow service; (4) implement frontend tables through the REST API. No frontend SQL/DDL, no uncontrolled auto-migration on startup, no destructive operations on the provided project before consent.

### High-level data flow

`React/AntD table -> NestJS REST API -> domain services + exact calculations -> Prisma transaction -> Supabase PostgreSQL`

`React -> image upload request -> authorized signed upload -> Supabase Storage`; after upload, BE validates/associates image metadata.

Frontend **renders** tables; only BE Prisma migration **creates** physical DB tables. Never implement `CREATE TABLE` in browser code.

## 3. Mandatory execution order / gates

### Phase 0 — Source inventory and baseline (no writes to source)

- Parse the entire original V9.1 code and V9.2 optimized version. List every exported business function, stage transition, status color, financial calculation, storage format, triggers, and exceptional cases.
- Read XLSX sheets, headers and content types; capture representative row fixtures. Document A:R layout, row 2 totals, rows >=3 products; audit worksheet meaning.
- **Critical:** PropertiesService Document Properties contains compressed/chunked manifests: `AFFZ91|version|parts|size` and keys under `AFF_PRODUCT_...`; source record contains `purchaseState`, `stageData`, `history`, `priceMauN`, `priceEndN`, `sellEndN`, `qtySellEndN`, etc. Spreadsheet export alone cannot reconstruct this. Provide a **read-only export Apps Script** on original project: enumerate only active product keys, validate manifest/chunks, decode/ungzip, checksum, dump full JSON + row display + metadata to a safe export. Never write source Properties as part of exporter.
- Produce `docs/LEGACY_RULE_MAP.md`, `docs/BASELINE_REPORT.md` and baseline JSON fixtures with expected paid/unpaid/refund/profit.
- Gate 0: no conversion starts without source inventory and auditable fixtures.

Theo quyết định owner ở đầu tài liệu, thay yêu cầu export live bằng JSON Source of Truth đã được xác nhận; dùng acceptance/checksums/fixtures mới. Exporter read-only vẫn là công cụ tham khảo, không còn là điều kiện yêu cầu owner chạy lại để hoàn tất Gate0.

### Phase 1 — Supabase DB connection FIRST

1. Set up Supabase DEV project. Obtain URLs/credentials from dashboard using secure environment management (no keys committed).
2. Scaffold NestJS project and Prisma; define `DATABASE_URL` and `DIRECT_URL` (or current recommended Prisma-compatible equivalent), plus Supabase URL/JWKS config. Add `.env.example` with dummy placeholders.
3. Implement Prisma DB connection and `/api/v1/health/live`, `/api/v1/health/ready` (readiness runs a harmless `SELECT 1`). Log sanitized DB connection errors; never reveal credentials.
4. Test connection from local dev, then from deployed BE staging runtime. Verify TLS, pooling, migration route, timezone UTC.
5. Gate 1: `prisma validate`, DB connectivity test, health endpoints and CI pass. **Do not build entity screens before this gate.**

### Phase 2 — Create physical schema through BE Prisma entities/migrations

Canonical entities (proposed relational model; preserve original JSON as provenance):

| Entity / table | Minimum fields and invariants |
|---|---|
| `users` | `id`, `auth_subject` unique, `role` (`admin`,`editor`,`viewer`), audit fields |
| `products` | UUID id, `root_name`, `root_name_normalized` unique, image pointer, `current_stage_type`,`current_stage_group`,`current_stage_index`, refund count, wholesale price, sample sales quantity, note, row version, timestamps, archived flag |
| `purchase_rounds` | UUID, product_id, group `SAMPLE`/`END`, round_index positive, **unique(product_id,group,round_index)**, order_price nullable, ordered, received, cancelled, verified, issue, ordered_at, received_at, last edited metadata |
| `stage_snapshots` | UUID, product_id, progress label, JSON snapshot, effective date, created_at; preserve multiple snapshots/events where legacy history does |
| `sales_details` | product_id, group, round_index, sales unit price, sold quantity, plus Sample wholesale/qty as required for source parity |
| `refunds` | product_id, related sample/end round IDs (nullable until mapped), eligibility result, review fields; **do not interpret eligibility as cash physically refunded** |
| `product_history` | append-only event id, product_id, event type, stage, before_json, after_json, original_legacy_payload, actor, timestamp, request id, import batch id |
| `product_images` | product id, storage path, content type, upload metadata |
| `legacy_records` | product id, raw compressed-decoded legacy JSON, checksum, original manifest/key, migration batch; immutable reference |
| `import_batches` | batch id, source hash, imported/failed counts, status, rollback reference and reconciliation report |
| `mutation_requests` | idempotency key, actor, action, payload hash, outcome reference; unique key preventing retries from double-applying |

Indexes for list filtering (status, stage, date, normalized name), foreign keys and restrictive cascading policy. Never cascade-delete financial events. Define optional DB views for **read-only** product financial projections; transactional writes remain in BE services.

Migration requirements: Prisma migrations version controlled; run on DEV first; schema inspection and CRUD integration tests; never use `prisma db push` against PROD; use migration deploy with approvals and backup. Gate 2: create/read/update test record + rollback on transaction failure + concurrent-edit conflict tests pass.

### Phase 3 — Port exact business logic into isolated domain engine

**Avoid reinterpretation:** port behavior of actual functions (`parseAffiliateStage`, `getPurchaseLedger`, `getPaymentSummaryForRecord`, `getRefundEligible91`, `calculateProjectedProfit`, `calculateStatus`, `getPaymentPurchaseConfigs`, `editBuy91`, plus status exceptions). Start with pure TypeScript engine and golden parity tests; adapt for Decimal only after confirming equality.

Source-observed contracts:

- Stage labels `Đặt mẫu N`, `Nhận mẫu N`, `Đặt End N`, `Nhận End N`, `Done` (positive N; support actual source dynamic N, not hard-coded two rounds). Stage normalized and unique per `(group,index)`.
- Buying price belongs to corresponding **Đặt** stage (`priceMauN` or `priceEndN`); the Nhận stage must not overwrite it. Blank price in a valid Đặt edit is meaningful; missing price must be reported rather than replaced by 0.
- Purchase ledger: only `ordered && !cancelled` incurs purchase; if amount exists, `received` => `paid`, not received => `unpaid`; sum **independently**. A missing amount increases missing-price counter; it cannot be silently treated as a known zero.
- `review` counts ordered, not-verified rounds. Canceled rounds do not contribute purchase amounts.
- Refund eligible amount: for each **received End N** in ledger, match **ordered Sample N**; add matching sample order price when present; otherwise increment missing. Do not present it as actual refunded cash.
- Projected profit from legacy: `wholesale * qty + sum(End sale price * End sold qty for active ordered/noncancelled End rounds) - End purchase cost`. Legacy comment assumes Sample cost refunded; distinguish this *projected* metric from settled cash profit. Verify all nullable/zero behavior with baseline fixtures.
- Status timing: 24 hours after sample receipt where applicable; End refund check after 15 days; "Hết hàng" sample receipt countdown 30 days; final refund statuses preserved. Timezone: present Asia/Ho_Chi_Minh to users, persist timestamps UTC; test exact boundaries and legacy `daysBetween` behavior.
- Manual status, note, PIC, date edits and 'verify', 'mark unreceived', 'cancel', 'restore' actions retain history; do not overwrite intentionally entered final status. Preserve "Nhận không có Đặt trước" / review flags rather than auto-asserting verified.
- Record and price slots survive stage navigation; stage changes must not relabel prices from another round. Root product rename/duplicate protection follows normalized identity.
- On each mutation: validate stage transition/field editing rules, retrieve current version, compute, transact domain change + history + idempotency record, return authoritative updated row and summary. Use optimistic locking (`version`); conflict => HTTP 409 with refresh/retry UI.
- Financial rollup computation must use backend query/aggregation, never iterating over all products in the FE. Cache only *derived* values, invalidated transactionally; don't let cached values become source of truth.

**Important audit point:** Existing source may have inconsistent historical snapshots and V9.1 versioned fixes. Record mismatches rather than silently repairing them. **Legacy is the baseline, not a guarantee it has no bugs**; any correction is an explicit approved change with regression fixtures.

### Phase 4 — REST API & permissions

Proposed endpoints:

- `GET /api/v1/products?search=&stage=&status=&page=&limit=&sort=`
- `POST /api/v1/products`, `GET /api/v1/products/:id`, `PATCH /api/v1/products/:id` (version + idempotency key)
- `GET /api/v1/products/:id/rounds`, `POST /api/v1/products/:id/stage-transition`
- `PATCH /api/v1/products/:id/rounds/:roundId/order-price`
- `POST /api/v1/products/:id/rounds/:roundId/verify`, `/mark-unreceived`, `/cancel`, `/restore`
- `GET /api/v1/products/:id/history` (paginated), `/financials`, `/status`
- `GET /api/v1/dashboard/summary`, `/dashboard/alerts`
- `POST /api/v1/images/upload-intent`, `POST /api/v1/products/:id/image/confirm`
- `POST /api/v1/imports/preview`, `/imports/commit` (admin only), `GET /api/v1/imports/:id/reconciliation`
- `GET /api/v1/exports/products.csv`, `GET /api/v1/exports/records.json`

Implement DTOs, authorization (`viewer`: read; `editor`: edit; `admin`: import/reconcile/user roles), rate limits, validation, endpoint docs, standard `problem+json` errors and CI integration tests. **No sensitive DB/service keys in browser.**

### Phase 5 — FE tables and UX/UI AFTER backend is verified

**Design intent:** Clean, friendly, light-first admin UI with good contrast, consistent labels/icons, accessible controls and shortcuts; responsive rather than cramming 18 columns on mobile. Users understand *what requires action*, not just codes.

**Desktop layout:** Sticky topbar (logo, environment, search, notifications, profile) + compact sidebar (Tổng quan, Sản phẩm, Công nợ, Cần xử lý, Lịch sử, Báo cáo, Cài đặt). A data grid occupying most screen width; sticky product-name column, optional fixed action column, user-selectable visible columns, horizontal scroll, server-side sorting/filtering/pagination, row density options and column resizing. Avoid unnecessary nested modals.

**Product grid, parity with A:R:** Product name, thumbnail, refund qty, stage, PIC, date, status, sample buy, end buy, sample wholesale, sample sold qty, end sell unit price, end qty, projected profit, notes, paid, unpaid, refund eligible. Explicit Vietnamese units (VND, sản phẩm); right-align values, group thousands, display dash for missing (not 0), negative financials distinctly. Total chips/cards with exact backend-derived values and indicators for missing prices/unverified records. Save state indicator: `Đang lưu…`, `Đã lưu`, `Không thể lưu` with rollback/retry.

**User workflows:**
- Click row => detail drawer with overview, stage timeline, separate Sample/End rounds, money breakdown and history (without losing list scroll position).
- Stage change via searchable dropdown + confirmation summary if financially meaningful; show before/after amounts.
- Inline editing only for allowed fields and stage, validation at field level and keyboard navigation (Enter save, Esc cancel, Tab next).
- Provide contextual tooltips: paid vs unpaid, **refund eligible ≠ refunded**, projected profit assumptions, missing price, needs reconciliation.
- Dedicated 'Cần xử lý' page for missing order price, unverified rounds, overdue refund checks, inventory/out-of-stock alerts, conflicting history.
- Bulk actions require preview + confirmation; never silently apply batch financial edits.
- History/audit timeline filterable by product, stage, event type; no hidden truncation.
- Mobile: cards, filter drawer, stage timeline and financial overview; no forced 18-column horizontal grid.
- Empty/loading/error/offline states, skeletons, toast actions, accessible labels, keyboard focus, color+text indicators (not color alone), dark mode optional after baseline UX.
- Images are lazy-loaded via signed URLs; virtualization for large lists. Debounced search; avoid saving on every keystroke.

**Suggested typography/theme:** system/Inter; 14–16 px body, 24–28 px screen headings, 8px rhythm, moderate corner radius, neutral canvas, one primary accent and semantic status colors. All currency cards have visible explanation and last-updated time. Do not overload UI with badges.

**Screens:**
1. Dashboard — paid/unpaid, eligible refund, projected profit, open tasks and recent activity.
2. Product listing — inline edit grid with saved filters and visible columns.
3. Product detail — rounds & prices, stage history, image, notes, financial ledger and audit.
4. Finance review — per-round breakdown, missing/verified and independent paid/unpaid sums.
5. Alerts — End after 15d, out-of-stock 30d, missing price, data conflicts.
6. Import/Export — dry-run diff, downloadable errors, backup metadata and reconciliation.
7. Settings — users/permissions, timezone, configurable columns; rule constants surfaced *read-only* until explicitly versioned.

### Phase 6 — Safe migration and reconciliation

1. Build a **read-only** export from original Google Sheets + Document Properties in the actual original Apps Script project. JSON includes full `purchaseState`, `stageData`, `history`, price slots, normalized product ID, current row, image references; checksum each record and entire export. Do not assume XLSX photo objects map to row images automatically.
2. Generate pre-import report for missing/duplicate root names, invalid price/date/stage, incomplete manifests, contradictions, missing stage prices. Block commit on critical errors; manual sign-off for exceptions.
3. DEV dry-run (`POST /imports/preview`), parse into staging and map 1:1 to proposed entities; preserve unmodified original JSON in `legacy_records`. Use unique import batch hash/idempotency.
4. Compare **per product and per round**, not only row 2 totals: sample/end incurred, paid, unpaid, eligible refund, projected profit, stage, verified, history event count and latest dates. Differences must be `0` for amounts within exact documented rounding policy. Missing legacy data is **missing**, not equal to 0.
5. Produce machine-readable CSV/JSON reconciliation and a human review screen. If mismatches exist: stop migration, do not overwrite records, fix conversion mappings and re-run dry-run.
6. Backup target database before PROD import; write in controlled transactions. Pilot with a few products first, validate UI and edits, then switch users only after full signoff. Provide rollback to previous UI/system + restores; no silent dual-write or sync.
7. Schedule periodic backups and test restore exercises, plus error monitoring/alerts after launch.

### Phase 7 — Quality gates and production release

**Required tests:**
- Round lifecycle: ordered -> unpaid; received -> paid; order price frozen against receive-step edits; cancel/restore/unreceive; dynamic N; missing vs zero.
- Multiple rounds with different prices, unmatched End refund, End not yet received, unverified records, duplicate/root-name renames.
- Profit with zero/negative/missing values, nullable qty, individual End quantities, decimal precision.
- Status time boundaries at 24h, 15 days, 30 days, timezone and DST-safe date handling.
- History integrity: append-only, no loss or duplication across repeated requests, rollback on failed transaction, concurrent edits 409, idempotent retries.
- UI tests: editing, validation messages, confirmations, mobile layout, keyboard flow, filters, empty and error states.
- Performance: baseline p50/p95 for list and save, no N+1 queries, indexes/EXPLAIN, test with 10x expected product/round count, compare with current Apps Script median on same fixture; do not promise a fixed speedup without measurements.
- Security: viewer cannot edit, DB credentials never client-visible, storage auth, RLS/direct access policy tested, audit actor populated.

**Go-live acceptance:** 100% eligible source products accounted for, no mismatched financial ledger/summary/profit, complete history, successful restore test, passing E2E, confirmed FE/BE deployment against PROD DB and verified auth. Record sign-off results in `docs/MIGRATION_SIGNOFF.md`.

## 4. Repository layout

```text
tiktok-affiliate/
  apps/
    api/src/{auth,products,rounds,financials,status,audit,imports,images,health}/
    api/prisma/{schema.prisma,migrations/}
    web/src/{app,pages,components,features,services,hooks,styles}/
  packages/
    finance-engine/src/{stages,ledger,refund,profit,status}/
    shared/src/{types,schemas,constants}/
  scripts/
    migration/{legacy-export-readonly.gs,validate-export.ts,import-dryrun.ts}
  tests/
    golden/{baseline-input.json,baseline-expected.json}
    integration/
    e2e/
  docs/{LEGACY_RULE_MAP.md,BASELINE_REPORT.md,MIGRATION_SIGNOFF.md,API.md,UX_UI.md,DEPLOYMENT.md}
  .env.example
  README.md
```

## 5. Suggested commands for Codex to execute phase by phase

### Prompt 1 — Connect DB ONLY

> You are implementing `TIKTOK_AFFILIATE_CODEX_IMPLEMENTATION_PLAN.md`. Begin with **Phase 0 and Phase 1 only**. Inspect provided V9.1, V9.2 and XLSX references. Scaffold NestJS + Prisma, safely configure Supabase Cloud PostgreSQL from env, add health/readiness endpoints and test DB connection. Do not create product UI and do not perform any write to the source spreadsheet. Explain env vars I must supply. Output code, test results and Gate 1 checklist. Mark changed code with truonglt start/end comments.

### Prompt 2 — Entities/migrations after DB works

> Proceed to Phase 2 only. Define Prisma schema and migration for products, rounds, stages, sales, refunds, audit, images, imports and idempotency. Generate a diagram/table showing relationships. Run validate/migrate on DEV Supabase and integration tests, test transaction rollback. Never use `db push` on PROD. Show Gate 2 results.

### Prompt 3 — Finance engine and BE

> Proceed to Phases 3–4. Port exact financial/status/stage behavior from provided Apps Script reference. First write golden fixtures for every rule and compare outputs, including empty vs zero. Implement authenticated NestJS API + decimal-safe transactional writes, history and optimistic locking. Document every rule conflict before deciding; do not change existing formulas without approval.

### Prompt 4 — Friendly FE

> Proceed to Phase 5 only once API and golden tests pass. Build polished, Vietnamese, mobile-responsive React + Ant Design UI with desktop financial grid, inline editing, product detail, stage timeline, financial explanation, status alerts, full history, and save/error feedback. Never calculate authoritative money on FE. Match UX spec and run accessibility and E2E tests.

### Prompt 5 — Safe data migration & release

> Proceed to Phases 6–7. Create read-only Apps Script exporter from original sheet plus Document Properties, preserve record JSON and history, run dry-run preview and per-product/per-round financial reconciliation. Stop on any discrepancy. Produce migration sign-off, deployment documentation, backup and rollback plan. Do not run PROD import without explicit user authorization.

## 6. Definition of done

- Managed Supabase PostgreSQL connected; no manual DB server deploy.
- Entities and schema created by BE Prisma migrations, FE only renders/edits through BE REST API.
- Backend is the sole calculation authority; every V9.1 monetary rule has golden parity tests.
- UI is smooth, friendly, Vietnamese, accessible, responsive, and explains money/status clearly.
- Historical records and audit log are preserved, migration mismatch count zero, rollback practiced.
- DEV and PROD separated, least-privilege secrets, tests, monitoring, backups and docs complete.

**Final instruction to Codex:** Prioritize correctness > preservation > usability > speed. If verification is impossible because original Document Properties are unavailable, say so and stop at dry-run; never manufacture missing financial data.
