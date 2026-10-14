<!-- truonglt phase1 report start -->
# Phase 1 — kết nối DEV thật và nền backend

Báo cáo mới nhất theo ngoại lệ owner: [GATE1_EXCEPTION_REPORT.md](phase1/GATE1_EXCEPTION_REPORT.md). CLI PASS; Actions BLOCKED_BY_BILLING; Render build/readiness chưa xác minh, Gate1 chưa nghiệm thu.

Cập nhật ngày 14/10/2026 (Asia/Ho_Chi_Minh). Xác nhận mới nhất của owner: project `nqdaykgasfnsaixkhbya` là DEV dành riêng cho TikTok Affiliate. Xác nhận này thay trạng thái “đang vận hành” trước đó; không yêu cầu tạo project DEV mới.

## Kết quả kết nối thật

Đã dùng chính hostname/user/port Session Pooler owner cung cấp cho cả DATABASE_URL và DIRECT_URL. Password được lấy từ env local đã có, giữ URL-encoded; không dùng placeholder YOUR_PASSWORD_ENCODED và không in/commit credentials.

| Kiểm tra | DATABASE_URL | DIRECT_URL |
|---|---|---|
| Environment | DEV đã xác nhận | Cùng DEV |
| Host/port | aws-0-ap-northeast-2.pooler.supabase.com:5432 | Cùng Session Pooler |
| SELECT 1 | 1 — PASS | 1 — PASS |
| TimeZone | UTC — PASS | UTC — PASS |
| TLS socket backend → endpoint | TLSv1.3, encrypted và authorized — PASS | TLSv1.3, encrypted và authorized — PASS |
| Certificate/hostname validation | rejectUnauthorized=true, servername đúng hostname, CA Supabase | Cùng cấu hình |
| current_database/current_schema | postgres / public | postgres / public |
| Transaction chỉ đọc khi kiểm kê | transaction_read_only=on | transaction_read_only=on |
| Public tables/views/materialized views/foreign tables/sequences | Không có | Không có |
| public._prisma_migrations | Chưa có | Chưa có |
| Migration/DDL chạy | Không | Không |

Bằng chứng machine-readable: `phase1/live-db-verification.json`. Hai phép kiểm tra cuối lúc 10:39:55 và 10:39:58 ngày 14/10/2026, giờ Việt Nam. Schema hiện có: auth, extensions, graphql, graphql_public, public, realtime, storage, vault; không đổi các schema Supabase quản lý.

DIRECT_URL ở đây là tên biến route cho Prisma CLI, không khẳng định đó là direct hostname db.*. Owner cung cấp Session Pooler cho route này; kết nối đọc đã chứng minh, chưa thử DDL hoặc migration write capability khi Gate0 còn thiếu. Trước Phase2 cần kiểm kê lại schema, không dùng db push hoặc tự tạo bảng trên Dashboard.

## Hai lớp TLS phải báo riêng

Sau khi thêm CA, SELECT đã chạy nhưng pg_stat_ssl trả false. Kiểm tra cũ coi flag này là TLS client và từ chối readiness; đã sửa cách kiểm tra đúng transport:

- Socket backend → Session Pooler: encrypted=true, authorized=true, protocol TLSv1.3; không tắt xác minh CA/hostname.
- `pg_stat_ssl` của session phía PostgreSQL sau pooler: `postgresSessionTls=false`. Đây không phải flag của socket backend → pooler; không tuyên bố TLS toàn tuyến. Giá trị false được giữ công khai trong evidence và readiness, không đổi thành true.

CA tải qua HTTPS từ endpoint Supabase phân phối: `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. Subject Supabase Root 2021 CA, isCa=true, self-signature verified; fingerprint SHA-256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`, expires 26/04/2031. Certificate và env đều Git ignored; không đổi trust store Windows.

Startup option default_transaction_read_only không được pooler áp dụng (đã quan sát off), nên không dựa vào option này để tuyên bố chỉ đọc. Wrapper query dùng Prisma interactive transaction + SET TRANSACTION READ ONLY, sau đó chỉ SELECT; mọi metadata probe thực tế trả readOnly=on. Transaction control không tạo/sửa table, view hoặc dữ liệu. CLI migrations không được gọi.

## Backend và kiểm thử

Node24.21.0/npm11.19.0/Git2.56.0.windows.2; NestJS12.1.3, TypeScript5.9.3, Prisma/client/adapter7.10.0. Type declarations pg được đồng bộ với adapter để build không gặp xung đột. Prisma schema vẫn không có entity nghiệp vụ hoặc migration.

| Kiểm tra | Kết quả |
|---|---|
| prisma validate | PASS local |
| Prisma generate + TypeScript build | PASS local |
| Health/transport/error/schema unit và HTTP mock tests | 12/12 PASS |
| HTTP /api/v1/health/live từ NestJS local thật | 200 |
| HTTP /api/v1/health/ready từ NestJS local với DEV thật | 200, UTC, TLSv1.3 |
| SELECT 1/TLS/UTC qua hai env routes | PASS thật |
| Catalog inspection trong read-only transaction | PASS thật, public không có objects |
| Phase0 regression/export integrity | Kết quả trước: 35 Node + 5 Python PASS; tài chính không đổi trong lượt này |
| GitHub CI execution | Chưa chạy thực tế; workflow offline đã có |
| Kết nối từ backend staging đã triển khai | Chưa có runtime staging để kiểm tra |

HTTP evidence: `phase1/live-health-verification.json`, kiểm tra lúc 10:41:08–10:41:09 giờ Việt Nam. Script khởi động local NestJS ở port tạm, gửi GET health rồi tự đóng app/pool; không deploy hoặc giữ background service.

Secrets, credentials và errors: `.env` local ignored; `.env.example` chỉ placeholder. Chỉ log allowlisted codes, không dump error message/SQL/stack/URI. Không dùng secret API đã lộ trong chat. Trước deployment phải hoàn tất rotate/revoke secret theo security gate của blueprint.

## Gate 1: LOCAL PASS, CHƯA NGHIỆM THU TOÀN BỘ

Còn thiếu hai kiểm tra bắt buộc: kết nối từ backend staging runtime và lần CI thực tế thành công. Không còn thiếu project DEV hoặc hai env routes local; không yêu cầu tạo DEV mới. TLS scopes khác nhau đã được ghi nhận rõ, không tự chỉnh cấu hình SSL server trên Supabase.

Theo quyết định Source of Truth mới, Gate0 đã đạt technical acceptance cho baseline all46: xem docs/GATE0_SIGNOFF.md. Không yêu cầu export lại hoặc lấy live metadata để xác nhận nguồn đã được owner chấp nhận. Phase2 chỉ chuẩn bị offline proposal; áp dụng DB vẫn chờ các gate/approval bắt buộc. Không Frontend/import/migration lúc này.

## Chạy lại

Từ root (Node phải có trên PATH; dùng npm.cmd trên Windows):

    npm.cmd run prisma:validate
    npm.cmd run build
    npm.cmd run test:phase1
    npm.cmd run db:verify
    npm.cmd run health:verify

Env local hiện đã có DEV, hai URI và DATABASE_CA_CERT_PATH. Không cần gửi lại password/API keys. Khi cấu hình staging, dùng cùng DEV và CA chính thức qua secure environment management. Không bỏ kiểm tra chứng chỉ để tránh lỗi TLS.

Tài liệu chính thức: [Supabase SSL modes/CA](https://supabase.com/docs/guides/platform/ssl-enforcement), [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Node TLS](https://nodejs.org/docs/latest-v24.x/api/tls.html), [node-postgres pool](https://node-postgres.com/apis/pool), [Prisma config](https://docs.prisma.io/docs/orm/reference/prisma-config-reference).
<!-- truonglt phase1 report end -->

Chuẩn bị CI/container/staging mới: [STAGING_READINESS.md](phase1/STAGING_READINESS.md). Build và 12 backend tests chạy lại PASS; Gate 1 vẫn thiếu CI/staging thực tế. Kiểm thử bảo toàn mới: 102 Node và 13 Python PASS, xem [Phase 2 review](phase2/REVIEW_AND_ACCEPTANCE.md).
