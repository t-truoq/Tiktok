<!-- truonglt render start prod fix report start -->
# Sửa runtime Missing script: start:prod

14/10/2026. Owner báo Render Build PASS, runtime lỗi `Missing script: start:prod` tại repository root. Root package.json trước đây chỉ có start:api; workspace apps/api đã có start=node dist/main.js. Đã bổ sung root start:prod=node apps/api/dist/main.js, không đổi workspace dependencies hoặc business logic.

## Entrypoint và cấu hình chính xác

tsconfig của API dùng rootDir=src, outDir=dist, module=commonjs. `src/main.ts` build thành **apps/api/dist/main.js**, đã xác minh file thực tế và khởi động qua npm root. Không cần dist/src/main.js hoặc Nest CLI tại runtime.

Render Node service hiện có:

| Setting | Giá trị |
|---|---|
| Repository / branch | t-truoq/Tiktok / main |
| Root Directory | Để trống, repository root |
| Build Command | npm ci --include=dev && npm run build |
| Start Command | **npm run start:prod** |
| NODE_VERSION | 24.21.0 |
| NODE_ENV / HOST | production / 0.0.0.0 |
| PORT | Dùng PORT Render cung cấp; API đọc process.env.PORT |
| Health Check Path | /api/v1/health/ready |
| Pre-Deploy Command | Trống; không migration/db push/import |

Workspace start tương đương: npm run start --workspace apps/api. Với Start Command root hiện tại, dùng start:prod ở trên. Nếu deploy Docker, CMD có sẵn chạy node apps/api/dist/main.js, không đổi.

## Kết quả CLI

- npm ci: PASS sau retry ECONNRESET bằng cache workspace; giữ package-lock và version dependencies. npm báo4high vulnerabilities; không chạy audit fix --force hoặc thay dependency trong bản sửa này.
- npm run build: PASS, Prisma7.10.0 generate + TypeScript compile.
- npm run test:phase1: 13/13 PASS.
- npm run start:prod:verify: PASS; helper thực sự spawn **npm run start:prod**, NODE_ENV=production/HOST=0.0.0.0/PORT ngẫu nhiên, GET live HTTP200 và JSON status=ok. Cleanup process tree PASS, không để service test chạy nền.
- Evidence: `START_PROD_VERIFICATION.json`, runtime Node24.21.0, không database writes. Root script JSON không hỗ trợ comment; helper/YAML/doc dùng truonglt start/end.

Node24 thuộc miền hỗ trợ chính thức của [Prisma ORM7](https://www.prisma.io/docs/orm/v7/reference/system-requirements) và được [Render hỗ trợ](https://render.com/docs/node-version). [Render Free](https://render.com/docs/free) có thể chạy Node web service cho staging; ngủ sau15phút idle, cold start khoảng1phút, filesystem ephemeral. Dữ liệu nghiệp vụ nằm Supabase, không phụ thuộc filesystem Render. Chưa có load/memory test trên service Free thật; không coi kiểm tra local là staging readiness PASS.

Sau khi deploy revision chứa script này, kiểm tra live/ready thực tế và ghi deployment commit/build/runtime logs đã loại credentials. Gate1 vẫn chưa nghiệm thu: GitHubActions BLOCKED_BY_BILLING, Render readiness mới chưa có evidence PASS. Không migration, db push, import hoặc sửa dữ liệu nguồn/Supabase.
<!-- truonglt render start prod fix report end -->
