<!-- truonglt Phase5 implemented management and preservation evidence start -->
# Phase5 — sản phẩm, ảnh riêng tư và các lượt đồng thời

Frontend React/TypeScript/Ant Design và NestJS REST /api/v1, không Swagger. Giữ Render/Vercel hiện có. Public WRITE theo cấu hình owner đã bật; JWT, ADMIN/EDITOR, RLS và dedicated runtime bắt buộc. Legacy/archived chỉ đọc.

Chức năng mới: thêm sản phẩm tên/PIC/ghi chú, phân loại MANUAL, giá/lượt mua để trống; tên trùng trả409, không gộp. Tạo sản phẩm/audit/idempotency cùng transaction. Ảnh JPG/PNG/WebP tối đa2MiB lưu append-only trong product_images.upload_metadata hiện có, driver PRIVATE_INLINE_V1; truy cập binary yêu cầu JWT/RLS, no-store/nosniff, list không chứa base64. Không thay managed Storage schema hoặc ảnh nguồn. Bảng và chi tiết dùng ảnh mới nhất; ảnh cũ vẫn trong database. Gallery/Storage driver có thể mở rộng sau.

Chi tiết có thẻ từng lượt Sample/End với giá mua/bán, số lượng và trạng thái. Thiếu giá dùng dấu gạch, zero vẫn0. Đặt mẫu/End tự chọn N tiếp theo; Đã nhận/Sửa giá/Bán End/Xác minh theo từng lượt. Chuỗi handler V9.1 hiện có được compose trong transaction/version/idempotency chung, preview trước commit, finance engine không đổi. Đồng thời Đặt mẫu2 + Đặt End1 hiển thị hai badges; current stage là lượt đang thao tác, không đại diện duy nhất toàn bộ hoạt động. Nhận một lượt không làm mất lượt khác. Input local date dùng IANA Asia/Ho_Chi_Minh duy nhất, calendar invalid bị từ chối, không đổi timestamp nguồn.

Đổi tên/archive root, tự ghi cash refund/bulk vẫn deferred. Ảnh nguồn không có URL hợp lệ hiển thị Chưa có ảnh, không tạo ảnh sản phẩm giả.

## Migration DEV

Owner đã phê duyệt và apply bằng Prisma7 migrate deploy, TLS strict/CA chính thức:
- 20261015010000_manual_product_origin — SHA256 3869a7bd46007521f28f74d8bce06495330807ca9d85e017989d6e5c4dbb95d1.
- 20261015010100_manual_product_image_permissions — SHA256 0779fa7c42f0f091389865c47d07e7d4b6d233e84bf31be8b5b5832f716c1451.

APPLIED_VERIFIED: target DEV/checksum cả4 migrations/status/roles/grants/policies thật đã kiểm tra. Enum MANUAL +2 INSERT policies, không sửa migration đã apply, không db push/reset/auth/storage DDL. Runtime INSERT products/images có RLS, không DELETE/TRUNCATE/DDL. Nguồn vẫn46 products,1224 imported events,133 imported snapshots. Evidence MANAGEMENT_MIGRATION_RESULT.json và MANAGEMENT_MIGRATION_LOG.txt.

## Verification

Prisma validate/generate, API TypeScript build, frontend TypeScript/Vite build PASS. Focused checks auto N, Sample2+End1, receive isolation, dynamic3/zero, IANA calendar, image signature/size, manual DTO PASS. Finance parity46/46 per-record/per-round cảV9.1/V9.2. Source SHA256 vẫn b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db.

Live PostgreSQL dedicated runtime: create/image RLS, replay, version conflict, binary integrity, no base64 list, concurrent rounds/finance/receive isolation PASS trong synthetic transaction rollback. Trước/sau đều46 products,46 images,1226 total history,1 mutation request. Hai runtime events/1request đã có trước kiểm tra, không bị sửa/xóa. Đây là service/RLS integration, không gọi là real JWT write E2E.

Production startup local live/ready200, TLSv1.3 client-to-pooler được verify, DB UTC. Anonymous products/image401. Real owner JWT GET session/products200, canCreate/canUpload true. Không committed fixture/HISTORY import. Evidence MANAGEMENT_CHECK_RESULT.json, MANAGEMENT_LIVE_RESULT.json, MANAGEMENT_STARTUP_RESULT.json. Deployment revision/health ghi MANAGEMENT_DEPLOYMENT_RESULT.json sau push.

Không chạy lại full Node/Python suites cũ theo yêu cầu owner; chỉ regression code mới/tài chính. GitHub Actions BLOCKED_BY_BILLING. Full authenticated browser create/upload/mobile acceptance chưa chạy trong công cụ; synthetic rollback không phải browser E2E PASS. Shared UI chunk khoảng1MB minified/gzip315KB còn performance concern, không che bằng warning limit.

Render Build npm ci --include=dev && npm run build; Start npm run start:prod. Không migration/import trong build/start. Không cần env mới; giữ runtime URL/CA/API/WRITE owner đã cấu hình. Vercel rewrite cùng origin, không cần mở CORS. Gate5 browser acceptance còn PARTIAL; migration/backend integration có evidence PASS.
<!-- truonglt Phase5 implemented management and preservation evidence end -->