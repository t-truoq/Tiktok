<!-- truonglt Phase5 React Vercel owner setup start -->
# Frontend React + Ant Design

Workspace `apps/web`: React19.3, Ant Design6.6.6, TypeScript5.9.3, Vite8.3.4. Giao diện tiếng Việt; backend là nguồn duy nhất tính money/ledger/refund/profit. Không Swagger, không database credentials/service key/JWT trong source hoặc bundle.

Chạy local: `npm run dev:web`, mở `http://localhost:5173`. Build: `npm run build:web`. Render giữ `npm run build` và `npm run start:prod` chỉ cho API; không thêm importer/seed vào startup.

## Vercel

Import repository `t-truoq/Tiktok`, branch `main`. Trong màn hình Services, chọn **web / Vite**, không chọn api / NestJS hoặc app / Container. Cấu hình được hỗ trợ ở cả hai root:

| Root Directory | Build | Output | Config |
|---|---|---|---|
| `apps/web` — nên dùng khi chọn web/Vite | `npm run build` | `dist` | `apps/web/vercel.json` |
| Trống — cấu hình monorepo từ root | `npm run build:web` | `apps/web/dist` | `vercel.json` |

Install `npm ci --include=dev`, Node24.x. Nếu Vercel hỏi, bật Include source files outside Root Directory để dùng root workspace lockfile. Không tự tạo project nếu owner đã có project liên kết. Hiện chưa có URL/project Vercel hoặc quyền Dashboard/API để xác minh deployment frontend.

Environment frontend chỉ gồm:

```dotenv
VITE_SUPABASE_URL=https://nqdaykgasfnsaixkhbya.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key của project>
VITE_API_BASE_URL=
```

`VITE_API_BASE_URL` có thể bỏ hẳn; mặc định dùng `/api/v1` cùng origin. Vite dev proxy và Vercel external rewrite chuyển tới Render, giữ Bearer JWT; không cần mở CORS khi dùng cách này. Backend trả Cache-Control no-store; route proxy cũng không cache. Không cấu hình database URL, secret/service_role key hoặc access token vào VITE_*.

Tài liệu chính thức: [Vercel external rewrites](https://vercel.com/docs/routing/rewrites). Không thay prefix API hoặc tính toán tài chính tại proxy. Strict JSON `vercel.json` không hỗ trợ comment; phạm vi cấu hình được mô tả bằng marker truonglt tại tài liệu này.

## Màn hình và quyền

- Tổng quan: cards paid/unpaid/refund eligibility/projected profit từ API, chọn phạm vi vận hành/legacy/tất cả.
- Sản phẩm: server pagination/search/filter/sort, 18 cột có lựa chọn, sticky tên, resize bằng pointer/keyboard, mật độ dòng, mobile cards, export trang hiện tại.
- Drawer chi tiết: các lượt Sample/End, sales, giải thích tiền, snapshots nguyên bản, history phân trang. Giá thiếu là “—”, zero là0; Decimal/BIGINT string không chuyển thành Number để tính tiền.
- Công nợ/Cần xử lý: backend lọc missing price/unverified/refund date/history conflict, không tự repair.
- History: global server pagination/filter và nguồn timestamp/actor; không cắt ngầm lịch sử.
- Reports: batch counts, source checksum/metadata; không public import endpoint.
- Settings: quyền read-only, múi giờ và nguyên tắc bảo toàn. Không tự nâng quyền hoặc sửa rules.

READ/WRITE capabilities lấy từ `/session` sau verified JWT/public.users. VIEWER không sửa; LEGACY_UNMATCHED/archived chỉ xem ngay cả ADMIN. Mutations dùng version + idempotency key; preview gọi backend READ ONLY, xác nhận rồi mới lưu; lỗi không optimistic overwrite tiền và retry giữ request key. Source history immutable.

Create/rename/archive, storage upload/cash refund, user-role provisioning UI và bulk financial mutations không thêm vì chưa có semantics/source contract được duyệt. Không hardcode baseline tiền trong frontend. Dữ liệu thật đã import, không dùng fake demo data.

Build/typecheck là kiểm tra compile; chưa thay thế owner/browser acceptance hoặc mutation E2E trên Vercel. Owner yêu cầu không chạy lại test suite. Không tuyên bố Phase5 Gate PASS trước khi có deployment và kiểm chứng UI/đăng nhập thật cần thiết.
<!-- truonglt Phase5 React Vercel owner setup end -->
