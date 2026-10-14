<!-- truonglt reviewed DEV schema-only migration plan start -->
# Phase 2 — kế hoạch migration DEV để review

Trạng thái **PREPARED_NOT_APPLIED**. Gate1 PASS theo ngoại lệ owner; Gate2 chưa PASS. Đây là migration **schema-only**, chưa import HISTORY và chưa được owner phê duyệt chạy.

## Artifact cụ thể

- Schema chính: apps/api/prisma/schema.prisma,13models giống datamodel offline đã review; generator trỏ đúng ../src/generated/prisma.
- Migration chính thức: apps/api/prisma/migrations/20261014063000_preserve_source_baseline/migration.sql; provider PostgreSQL trong migration_lock.toml.
- SHA256 SQL: `148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93`. Dòng kết thúc file được bảo toàn bằng .gitattributes; không sửa migration sau khi apply.
- SQL tạo13bảng/RLS13bảng/10immutabletriggers; enums, unique/FK/indexes/checks nằm cùng transactionBEGIN..COMMIT. Không INSERT/UPDATE/DELETE/TRUNCATE/DROP/COPY dữ liệu. Precondition từ chối nếu public có object ngoài _prisma_migrations.
- Generator chỉ Prisma validate + migrate diff from-empty/to-schema file, không kết nối DB và không deploy. App startup/Render build không gọi migration.

## Preflight và rủi ro

DEV_PREFLIGHT.json xác minh06:25:52UTC: đúng project nqdaykgasfnsaixkhbya, public rỗng, chưa _prisma_migrations, rolepostgres có CREATE/USAGEpublic, anon/authenticated/service_role tồn tại. SELECT trong readOnlytransaction với TLS1.3 vàUTC. Đây là kiểm tra catalog, không thử quyền bằng CREATE và không chứng minh khả năng backup/restore.

Rolepostgres có BYPASSRLS=true; không dùng nó làm business runtime khi triển khai CRUD. Migration hiện deny client roles; **backend non-owner cũng không có policy**. Dedicated runtime role/grants/policies phải review và integration-test trước business API, không tự dùng BYPASSRLS để vượt kiểm soát.

Chưa kiểm chứng backup/restore rehearsal, SQL custom bằng PostgreSQL thật hoặc Prisma Schema Engine migration route. CLI migration không dùng adapter-pg SSL config của health; trước apply phải cấu hình migration URL verify-full + sslrootcert theo CA thực tế và xác minh transport, không giả định DATABASE_CA_CERT_PATH được CLI tự đọc. Không log URI/password. Không đổi sang no-verify.

## Trình tự sau approval riêng

1. Hoàn thành backup phù hợp/restore rehearsal, lưu reference và checksum; catalog snapshot không thay backup có thể restore. Xác minh phạm vi chỉpublic, không sửa auth/storage hoặc sourceJSON.
2. Re-inspect catalog/role/TLS ngay trước apply; dừng nếu schema thay đổi. Xác nhận SQL hash trên khớp bản owner review và migration-capable Session Pooler route.
3. Chỉ sau owner phê duyệt schema-only action, dùng Prisma7 migrate deploy với config apps/api/prisma.config.ts; không Dashboard SQL, không db push, không migrate dev/shadowDB lên project này. Không chạy trong Render startup/pre-deploy.
4. Kiểm tra migration history,13tables/constraints/indexes/RLS/triggers, rồi chạy synthetic tests theo INTEGRATION_TEST_PLAN.md trong transactions có rollback. Chưa dùng46records nguồn làm dữ liệu test.
5. Inject failure kiểm tra transaction rollback/concurrent version conflicts/idempotency; kiểm tra denied client roles và immutable history. Gate2 chỉPASS khi live tests có evidence.

Nếu DDL lỗi trướcCOMMIT, transaction rollback schema changes; engine có thể để lại tracking table/failed migration entry. Phải inspect rồi review recovery, không tự resolve/đánh dấu applied hoặc xóa. Nếu đãCOMMIT, không tự drop schema/disable triggers/deletehistory; restore/recovery phải duyệt riêng và không được làm mất dữ liệu managedschemas.

## Kiểm thử chuẩn bị

Prisma validate/generate/TypeScript build PASS.104Node preservation/schema guards +13Python independent tests +17backend tests PASS. Guard kiểm tra model parity, SQL hash, transaction/precondition, không có DML hoặc destructiveDDL. Đây chưa là live SQL/RLS proof.

Raw HISTORY vẫn giữ nguyên local:46records,1.224events,133snapshots,24matched/22legacy; null/blank/zero/missing, Decimal và dynamic rounds không thay đổi. Import có approval riêng sau reconcile/backup/restore/idempotency thực tế. File nguồn/credentials tiếp tục Git ignored; fixtures công khai theo phê duyệt trước vẫn giữ nguyên.

Sau Gate2 là Phase3 finance-engine/backend business logic theo V9.1 và parityV9.2; kế hoạch tại docs/phase3/BUSINESS_LOGIC_PLAN.md. Chưa frontend, chưa import.
<!-- truonglt reviewed DEV schema-only migration plan end -->
