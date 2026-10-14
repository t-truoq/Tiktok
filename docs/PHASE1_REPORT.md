<!-- truonglt phase1 report start -->
# Phase 1 — nền backend và kết nối PostgreSQL

Ngày kiểm tra: 14/10/2026. Chỉ làm các bước độc lập được người dùng cho phép khi Gate0 đang chờ export.

## Đã thiết lập

- Node.js v24.21.0, npm 11.19.0, Git 2.56.0.windows.2 hoạt động bằng đường dẫn đầy đủ. PATH đầu phiên không chứa công cụ; không cần cài lại. PowerShell execution policy không cho npm.ps1, dùng npm.cmd và không đổi execution policy.
- Monorepo npm chỉ có apps/api, NestJS 12.1.3, TypeScript 5.9.3, Prisma/client/adapter-pg 7.10.0 (ổn định, không chọn npm latest8rc). Dependency lock được lưu.
- Prisma7 dùng prisma.config.ts cho CLI/migration URL và adapter-pg dùng DATABASE_URL cho runtime. Schema hiện không có model nghiệp vụ/migration. Offline validate/generate dùng URI unreachable giả nếu DIRECT_URL chưa có; không nhận đó là connection pass.
- /api/v1/health/live trả200; /api/v1/health/ready query SELECT1 cùng TimeZone/TLS session, chỉ trả200 khi DB query thành công, TLS=true và timezoneUTC. Lỗi/config thiếu trả503 problem+json tiếng Việt, no-store.
- SSL certificate verification luôn bật; tùy chọn CA PEM chính thức qua DATABASE_CA_CERT_PATH. URL SSL flags không được override rejectUnauthorized. Runtime pool max4/timeouts3s, idle10s; session options UTC và default_transaction_read_only=on. Không tự migration startup.
- Chỉ log allowlisted error code/category, không message/stack/SQL/connection URI/user/password. API secret không dùng. Supabase URL/JWKS config chưa được coi là kết nối PostgreSQL.
- `.env`/certificates/keys/exports/generated/build/deps/cache được Git ignore; `.env.example` chỉ placeholder. Không tạo FE.

## Kiểm thử và giới hạn

| Kiểm tra | Kết quả |
|---|---|
| prisma validate | PASS local |
| Prisma generate + tsc build | PASS local |
| Health HTTP200/503, mock SELECT/TLS/UTC, driver-error masking | 8/8 PASS local |
| Pure legacy/exporter Node regression | 35/35 PASS local, synthetic/mock |
| Envelope/record/history integrity validator | 5/5 PASS local, synthetic |
| Runtime PostgreSQL tới supplied direct hostname | FAIL: DATABASE_NOT_REACHABLE |
| DIRECT_URL route | NOT_RUN: thiếu URL thực tế từ Dashboard |
| TLS/UTC trên DB thật | CHƯA XÁC MINH vì chưa kết nối thành công |
| Pooler mode/host/port, migration capability | CHƯA XÁC MINH |
| Supabase DEV riêng | Chưa có; người dùng xác nhận supplied project đang vận hành |
| Backend staging connection | Chưa có runtime staging |
| GitHub CI run | Workflow đã tạo; chưa có remote/run thực tế |

Đã thử query chỉ đọc cả trong và ngoài sandbox; driver Prisma báo P2010 với adapter cause.kind=DatabaseNotReachable. Chỉ in category đã lọc; không dump error/raw credential. Chưa chứng minh nguyên nhân là IPv6, password, project pause hoặc DNS. Theo [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres), direct connection thường phụ thuộc IPv6; cần copy đúng Session Pooler URI từ Connect nếu direct route không dùng được, không invent hostname/port/user.

`tsx` từng lỗi uv_os_get_passwd trong sandbox; đã chuyển công cụ db:verify sang compiled Node script. Không cần nới PowerShell execution policy hoặc thay logic tính toán.

## Gate 1: CHƯA ĐẠT

Live connection/local+staging và DEV isolation còn thiếu; không cho phép tiến Phase2. Mọi thử kết nối tới project hiện tại đều read-only, không tạo bảng/import/update/delete/repair. `.env` local giữ riêng runtime URI được người dùng cung cấp, không chứa secret API; không log/commit credentials.

## Chạy lại

1. Xác nhận/tạo Supabase DEV riêng. Copy runtime URI và migration URI thật từ Dashboard>Connect vào apps/api/.env, đặt DB_ENVIRONMENT=DEV. URL-encode password; không gửi keys/password qua chat.
2. Nếu provider yêu cầu CA, tải CA chính thức và đặt DATABASE_CA_CERT_PATH. Không tắt certificate verification.
3. Tại root: npm.cmd run prisma:validate → npm.cmd run build → npm.cmd run test:phase1 → npm.cmd run db:verify. Trong phiên PowerShell hiện tại cần thêm C:\Program Files\nodejs vào PATH hoặc gọi npm.cmd bằng full path.
4. Kiểm tra liveness/readiness ở http://localhost:3000/api/v1/health/live và /ready. Trên staging dùng cùng URI DEV/secrets được quản lý riêng, xác nhận TLS/UTC thật và pooler/migration route.
5. Nếu chỉ chẩn đoán project đang vận hành đã được user xác nhận: DB_ENVIRONMENT=EXISTING, npm.cmd run db:verify -- --existing-readonly. Kết quả này không chứng nhận DEV/staging Gate1.

Không cần API secret để SELECT1. Secret API đã xuất hiện trong chat phải được rotate/revoke trước deployment theo security gate của blueprint; không dùng giá trị đó trong development.

Tài liệu chính thức đã kiểm tra: [NestJS](https://docs.nestjs.com/first-steps), [Prisma config](https://docs.prisma.io/docs/orm/reference/prisma-config-reference), [Prisma PostgreSQL/adapter](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql), [Supabase Prisma](https://supabase.com/docs/guides/database/prisma).
<!-- truonglt phase1 report end -->
