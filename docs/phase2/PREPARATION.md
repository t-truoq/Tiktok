<!-- truonglt phase2 preparation start -->
# Phase 2 — proposal offline sau Gate0

Review mới và kết quả kiểm thử trước import: xem [REVIEW_AND_ACCEPTANCE.md](REVIEW_AND_ACCEPTANCE.md). Phần dưới là proposal ban đầu; trạng thái hiện tại vẫn chỉ OFFLINE PASS, chưa nghiệm thu Gate 2.

Đã chuẩn bị `schema.prisma` và `migration-preview.sql` trong docs/phase2. Prisma validate và migrate diff từ empty datamodel tới schema file chạy hoàn toàn offline. Không tạo migration trong apps/api/prisma/migrations, không đổi schema API đang dùng, không gọi Supabase hoặc thực thi SQL.

## Quan hệ và bảo toàn dữ liệu

| Entity | Vai trò / mapping |
|---|---|
| source_archives | File HISTORY nguyên byte, SHA-256 pinned, metadata và setup property; immutable |
| import_batches | Source+mapping version unique, trạng thái dry-run/approval/reconciliation/rollback |
| products | Đủ 46 rows theo legacy key; raw name/normalized identity giữ riêng; 24/22 chỉ là classification, archived=false không đổi tự động |
| legacy_records | 46 decoded text+JSON, manifest/chunks/checksum, field types và source schema version; không overwrite với ensureRecord |
| legacy_values | Raw JSON pointer/state: MISSING/NULL/BLANK/NUMBER/TEXT/BOOLEAN/ARRAY/OBJECT; nullable Decimal chỉ là typed representation, không thay raw |
| purchase_rounds | Source raw purchaseState trước; boolean nullable giữ unknown/missing. Không import inferred state của 22 legacy như thể source đã có |
| sales_details | Per-round buy/sell/qty states riêng, dynamic N, không đổi null/blank thành0 |
| stage_snapshots | Đủ 133 entries raw, source label/pointer/date text; append-only, không unique theo stage label làm mất nhiều snapshot sau này |
| product_history | Đủ 1.224 raw events theo source order, index và type string kể cả END_PRICE_EDIT; giữ unknown actor/date; append-only |
| refunds | Eligibility và actualRefundData riêng; không tự tạo cash refund từ eligibility/XLSX S |
| product_images | Legacy formula/value metadata; không fabricate storagePath hoặc map nhị phân ảnh chưa có nguồn rõ |
| users | Supabase auth subject/role; không gán user giả cho lịch sử legacy |
| mutation_requests | Actor+idempotency unique, payload hash, outcome; mọi write mới audited/versioned ở backend |

Product → rounds → sales, refunds trỏ các rounds nullable. Product → snapshots/history/images/legacy records; source archive → records/batches; actor → history/requests. Tất cả financial/provenance foreign keys dùng Restrict, không cascade-delete.

Round index dùng BIGINT với CHECK 1..9007199254740991 để giữ đúng giới hạn safe integer của parser V9.1, không thêm giới hạn Int32 hoặc hard-code N=2.

Draft có Decimal(18,2) money và Decimal(18,3) quantity; 141 top-level finance numeric fields trong source hiện có scale0. Trước typed import, preflight phải kiểm tra **mọi** slot/history value chống overflow hoặc silent rounding, giữ invalid text/raw values. Không dùng schema numeric để “làm sạch” source. local text timestamps không có timezone giữ nguyên; occurredAtUtc nullable, recordedAt/createdAt là thời gian ingest/server, không phải thời gian event legacy.

Custom SQL preview đề xuất positive index/version, immutable source/history/snapshot triggers, RLS deny direct client access và REVOKE anon/authenticated. Đây chưa là bằng chứng các constraint/triggers đã chạy trên DB. Backend sẽ là sole mutation path; role/grants phải được kiểm thử thật trong Gate2/4.

## Idempotency và reconcile phải triển khai trước import

- Identity stable theo legacy key, không merge tên có vẻ tương tự. Source checksum+mapping version làm batch identity; retry trả cùng batch, không append trùng history.
- Dry-run tạo mapping report đủ 46 records, 1.224 events và 133 snapshots. So sánh raw decoded hash/type/presence, purchaseState, all price/sales slots và event payload/order trước khi commit.
- So sánh V9.1 projections trên all46 và riêng24/22; missing/unverified/conflict vẫn có flags. Không bỏ 22 legacy để rollup khớp XLSX.
- Bảo toàn XLSX observations riêng; không thêm S hoặc image binary vào source JSON như thể source đã chứa chúng.
- Backup/export/rollback source archive và target transaction bắt buộc. Không dùng schema migration như data import; đây là hai thao tác với approval riêng.

## Trạng thái nghiệm thu

Gate0: PASS theo quyết định nguồn mới. Gate1: local pass, thiếu staging và CI run thực tế. Phase2: **PREPARED OFFLINE**, chưa Gate2 pass.

Còn phải làm sau approval/gates: re-inspect DEV schema, kiểm tra migration route/grants/CA trên runner thực tế, đưa schema được duyệt vào active Prisma migration folder, deploy reviewed migration trên DEV, kiểm thử CRUD/transaction rollback/optimistic conflict/idempotency/immutable history/RLS/restore. Không db push; không CREATE TABLE từ Dashboard; không tự chạy SQL preview.
<!-- truonglt phase2 preparation end -->
