<!-- truonglt Phase5 frontend implementation evidence start -->
# Phase5 — IMPLEMENTED / VERCEL ACCEPTANCE PENDING

Đã thực hiện sau HISTORY import/reconciliation thành công theo approval owner. Frontend React + TypeScript + Ant Design tại apps/web, giao diện tiếng Việt; login Supabase thật và REST `/api/v1`. Owner yêu cầu không chạy lại test suite; chỉ compile/build và xác minh endpoint cần thiết, không gửi mutation thật vào dữ liệu vận hành.

Implemented: dashboard4 chỉ tiêu, phạm vi vận hành/legacy/tất cả; products18 cột tùy chọn/resize, sticky tên, server search/filter/sort/pagination, mật độ dòng/mobile cards, saved filters, CSV trang hiện tại; drawer rounds/sales/ledger/snapshots/history; finance review/alerts, global audit pagination, batch/archive report, quyền/timezone settings. Lazy-load protected pages/detail. Empty/loading/error/retry states và keyboard controls.

Mutations: role/capabilities từ verified `/session`, khóa legacy/archived ở cả server và client; strict DTO, version/idempotency; READ ONLY preview do backend tính before/after, confirm trước commit, failed save không optimistic ghi đè tiền. Currency/BIGINT string được format bằng chuỗi, không arithmetic Number, không hardcode baseline. UI không tạo/rename/archive root hoặc tự repair unverified/conflicts; không upload/cash refund/bulk mutations khi chưa có rule được duyệt.

Backend additions: per-product finance cho list, sourceView slots, computedStatus/attention chỉ đọc, exact stage filter, global history/review phân trang, batch relation counts, session capabilities, preview và archival guard. Không thay finance engine/source JSON/schema/migration. Chỉ server xử lý monetary math.

Build API Prisma generate + TypeScript PASS; frontend strict TypeScript + Vite production build PASS. npm install giải quyết dependency lock, audit output0 vulnerabilities. Không chạy lại Node/Python suites sau yêu cầu owner. 107/104/14 kết quả trước Phase5 là historical regression, không claim đã rerun cho code Phase5.

Local preview http://127.0.0.1:5173 đã mở; màn hình login tiếng Việt render và publishable key/Auth settings HTTP200. Không tự nhập credential người dùng hoặc fake Auth/JWT để claim browser acceptance. Full authenticated browser navigation/editing/keyboard/mobile workflow **chưa kiểm chứng**, owner có thể login trên preview. Production bundle có UI shared chunk khoảng1MB/minified (gzip314KB), là residual performance concern; không che bằng việc tăng warning limit. Virtualization cho quy mô vượt pagination hiện tại chưa thêm.

Vercel configs ở root và apps/web; external rewrite cùng origin tới Render, không cần mở CORS theo quyết định owner. Root apps/web: build npm run build, output dist; repo root: npm run build:web, output apps/web/dist. Cần URL/project Vercel và environment public từ owner; agent không có phiên đăng nhập/API token Vercel. Chưa claim deployed/frontend Gate5 PASS.

Source46/1224/133/71 đã commit DEV với evidence Phase4, active24 totals giữ nguyên. Public WRITE được owner bật nhưng agent không mutation thật; real-positive-write evidence trước đó là synthetic rollback Phase3. Không tự chuyển production release/Phase6 hoặc làm destructive rollback.
<!-- truonglt Phase5 frontend implementation evidence end -->
