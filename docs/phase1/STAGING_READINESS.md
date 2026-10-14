# Chuẩn bị CI và backend staging

Cập nhật: repository đã có origin/main và source đã push; owner tạm ngừng Actions do BLOCKED_BY_BILLING. Xem [GATE1_EXCEPTION_REPORT.md](GATE1_EXCEPTION_REPORT.md) và [OWNER_RENDER_SETUP.md](OWNER_RENDER_SETUP.md) để biết trạng thái hiện tại. Các đoạn “chưa có repository” bên dưới là lịch sử chuẩn bị ban đầu.

CI workflow `.github/workflows/backend.yml` chạy npm ci, Node/Python validation, schema preview offline, build/backend tests và Docker build. Job staging chỉ chạy qua workflow_dispatch sau local-validation, dùng GitHub environment `staging`; chỉ SELECT/health, không có deploy/migrate/import step.

Đã có Dockerfile multi-stage, non-root runtime, HOST=0.0.0.0 và healthcheck liveness. `.dockerignore` loại env/cert/nguồn HISTORY khỏi build context; runtime chỉ chứa dependencies và compiled backend. Readiness là `/api/v1/health/ready`; không dùng liveness để tuyên bố DB sẵn sàng. Container build chưa chạy local vì chưa có docker executable.

Runtime cần NODE_ENV=production, DB_ENVIRONMENT=DEV, PORT theo provider; DATABASE_URL và DIRECT_URL là Session Pooler DEV đã được owner chọn. Inject secret URI qua secret manager; mount CA read-only ngoài image và đặt DATABASE_CA_CERT_PATH. Không đưa credentials vào Git, build arguments hoặc image. Không dùng Supabase secret API key cho kiểm tra DB. Security gate rotation/revoke key đã lộ trong phiên trước vẫn cần hoàn tất trước deployment theo blueprint.

GitHub environment `staging` cần secrets DATABASE_URL, DIRECT_URL, DATABASE_CA_CERT_PEM; variable STAGING_BASE_URL là URL HTTPS của backend đã triển khai. Staging job tạo CA file quyền0600, kiểm tra hai DB routes, GET live/ready từ URL thật, upload sanitized evidence rồi xóa CA. Không upload file plan/raw data. Tham khảo [GitHub secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

Chưa có Git remote, GitHub repository URL, provider/server staging hoặc staging URL; chưa có CI run/deployment evidence. Cấu hình deployment theo provider phải hoàn thiện khi có target. Docker/CI chưa được xác minh thực thi, không ghi PASS cho các mục này.

Gate 1 chỉ PASS toàn bộ khi có CI run thành công và runtime staging thật xác minh SELECT 1/TLS/UTC, kèm revision/runtime evidence. Không cần Supabase project DEV mới. Sau đó mới trình kế hoạch migration DEV; mọi thao tác schema/data vẫn cần phê duyệt riêng.
