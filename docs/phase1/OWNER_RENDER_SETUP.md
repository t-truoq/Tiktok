<!-- truonglt render owner setup start -->
# Thiết lập service Render hiện có

Service staging được owner cung cấp: https://tiktok-6kwu.onrender.com. Repository https://github.com/t-truoq/Tiktok hiện public; owner đã cho phép công khai dữ liệu nguồn và fixtures. Không đưa credentials vào Git.

Nếu chưa có deployment thành công, kiểm tra service hiện có trong Dashboard, không tạo service/project Supabase mới:

1. Repository `t-truoq/Tiktok`, branch `main`, Root Directory để trống (monorepo root).
2. Node runtime: Build `npm ci --include=dev && npm run build`; Start `node apps/api/dist/main.js`. Giữ plan/region hiện có. Nếu service dùng Docker, chọn Dockerfile root với build context root, giữ CMD mặc định.
3. Env NODE_VERSION=24.21.0 (Node runtime), NODE_ENV=production, HOST=0.0.0.0, DB_ENVIRONMENT=DEV; dùng PORT do Render cung cấp. DATABASE_URL/DIRECT_URL lấy từ env local an toàn, Session Pooler của DEV đã xác nhận; không gửi giá trị lên chat.
4. Secret File `database-ca.crt` chứa CA chính thức đã dùng local; DATABASE_CA_CERT_PATH=/etc/secrets/database-ca.crt. Không tắt certificate verification để tránh lỗi TLS.
5. Health Check Path `/api/v1/health/ready`. Không cấu hình Pre-Deploy Command chạy migration/seed/import/db push. Deployment hiện tại chỉ dựng backend kiểm tra DB read-only.
6. Security gate blueprint yêu cầu rotate/revoke Supabase secret key đã lộ trước deployment; backend health không cần key này và không sử dụng nó.
7. Sau khi credentials/config và CI đúng, deploy revision đã kiểm thử rồi lưu deployment ID/commit và kết quả health. Khi lỗi, cung cấp phần build/runtime logs đã loại credentials; không gửi toàn bộ Environment.

Reference YAML `render-staging.yaml` chỉ để đối chiếu cấu hình, chưa được áp dụng. Không có phiên browser/API Render được kết nối trong môi trường agent, nên chưa thể đọc dashboard logs hoặc sửa service settings bằng quyền owner.

GitHub environment `staging`: secrets DATABASE_URL/DIRECT_URL/DATABASE_CA_CERT_PEM; variable STAGING_BASE_URL=https://tiktok-6kwu.onrender.com. Workflow_dispatch chạy readonly DB và remote health verification. CI job local-validation tự chạy khi push.

Tài liệu chính thức: [Render Node deployment](https://render.com/docs/deploy-node-express-app), [Environment/Secret Files](https://render.com/docs/configure-environment-variables), [Blueprint reference](https://render.com/docs/blueprint-spec).
<!-- truonglt render owner setup end -->
