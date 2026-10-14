<!-- truonglt approved migration preflight blocker start -->
# Phase2 — dừng trước apply theo điều kiện owner

Owner đã phê duyệt schema-only migration DEV với SHA256 đã chỉ định. Approval tồn tại nhưng có điều kiện: yêu cầu3 bắt buộc dừng nếu chưa có phương án backup/restore khả dụng. Chưa gọi Prisma migrate deploy, status/resolve/reset/db push hoặc import; không sửa migration SQL.

## Kiểm tra đã hoàn thành

- SQL SHA256 thực tế khớp `148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93`.
- DEV_PREFLIGHT.json mới: đúng project nqdaykgasfnsaixkhbya; publicObjects=[], _prisma_migrations chưa tồn tại; CREATE/USAGEpublic có quyền; anon/authenticated/service_role tồn tại.
- Client-to-endpoint dùng CA chính thức, rejectUnauthorized=true và default hostname verification, TLS1.3/UTC/readOnly=on. Đây là bằng chứng adapter-pg; **không thay cho Prisma Schema Engine CLI TLS verify-full**.
- Không có backup dump/manifest được xác minh trong workspace; không tìm thấy pg_dump/pg_restore/psql trên PATH hoặc PostgreSQL tools directory; chưa có quyền Management API/provider backup được cấu hình. Không kết luận Supabase không có backup, chỉ chưa thể chứng minh backup/restore khả dụng.

## Blocker phải giải quyết trước deploy

Cần backup reference của đúngDEV (thời điểm, trạng thái thành công, phạm vi), quyền và procedure phục hồi khả dụng. Với dump local cần artifact/checksum và pg_dump/pg_restore tương thích server; restore rehearsal vào môi trường cô lập để chứng minh phục hồi, không ghi đè auth/storage hoặc dữ liệu cũ trênDEV. Với provider backup cần xác minh restore route/permissions/limitations và phạm vi managedschemas; full-project restore không tự được phê duyệt bởi schema-only approval.

Catalog snapshot hoặc public rỗng không thay thế yêu cầu backup/restore của owner. TransactionBEGIN..COMMIT là thiết kế rollback DDL chưa chạy, không phải backup có thể restore. Không tự drop schema/disable triggers/resolve failed migration; không thử recovery trên auth/storage.

Khi blocker này được xử lý, approval schema-only đã nhận vẫn giữ hiệu lực trong phạm vi owner chỉ định: recheck checksum và DEV; xác minh Prisma7 migration-capable SessionPooler với CA/hostname verification qua config; chỉ migrate deploy nếu TLS an toàn và backup/restore đã xác minh. Dừng nếu CLI không tương thích, không tắtTLS hoặc sửaSQL để vượt gate.

## Kết quả nghiệm thu

Migration: NOT_EXECUTED. Remote schema diff: zero changes, public vẫn rỗng. _prisma_migrations/13tables/constraints/indexes/RLS13/immutabletriggers10 **chưa có kết quả sau apply**. Synthetic integration/idempotency/permission/rollback/immutable tests: NOT_RUN. Gate2 BLOCKED, chưa PASS; không ghi FAIL cho tests chưa chạy. Gate1 vẫn PASS_OWNER_EXCEPTION. Phase3 chỉ có kế hoạch, chưa triển khai engine/import/Frontend.

Evidence: OWNER_APPROVAL_PREFLIGHT.json và DEV_PREFLIGHT.json. Tài liệu provider: [Supabase backups](https://supabase.com/docs/guides/platform/backups). Không gửi mật khẩu/API token trong chat; nếu dùng provider backup, chỉ cần thông tin reference/thời điểm/trạng thái/phương án restore không chứa credentials.
<!-- truonglt approved migration preflight blocker end -->
