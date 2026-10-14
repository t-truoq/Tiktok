<!-- truonglt Phase3 actual implementation evidence start -->
# Phase 3 — PARTIAL / SECURITY BLOCKED

Ngày14/10/2026. Đã triển khai code local theo owner approval. Chưa commit/push/deploy code Phase3 vì approval yêu cầu security gates đạt trước các hành động đó. HEAD hiện tại `4153740f989feca5afc26317ab0f238d0f426a07` là commit có trước lượt triển khai này; không phải commit Phase3.

## Code và kết quả đã kiểm chứng

- `apps/api/src/finance/engine.ts`: TypeScript/Decimal parser, dynamic rounds, legacy normalization trên clone, payment ledger/summary, incurred/sample/End costs, End sales revenue/quantity, refund eligibility, projected profit, status với explicit clock. Không dùng Number cho arithmetic tiền; không thêm rounding chưa có trong source.
- `apps/api/src/business/`: contracts/DTO validation; source-traced operations; repositories; transactional services; JWT/JWKS guard; REST controllers; safe error filter và BIGINT/Decimal serialization. Các vùng code có marker truonglt start/end.
- `apps/api/src/app.ts`: đăng ký business module, giữ health/start. Business writes vẫn disabled mặc định; không fallback DATABASE_URL owner cho CRUD.
- `apps/api/test/finance.test.cjs`, `business.test.cjs`, `business-http.test.cjs`: per-record/per-round oracle V9.1/V9.2, status boundaries, mutation reference tests, JWT signatures/tampering, role denial, DTO/scale/precision, HTTP auth và query validation.
- `scripts/phase3/parity-report.cjs`, `integration-live.cjs`: báo cáo parity và live Prisma service synthetic transactions. `tests/phase0/phase3_finance_independent_test.py`: independent Decimal math đối chiếu output TypeScript trên frozen normalization projection; không gọi là independent normalization port.
- Tài liệu mapping/API và proposal runtime security nằm trong cùng thư mục. SQL proposal **chưa thực thi**.

| Verification | Result/evidence |
|---|---|
| npm ci --include=dev | PASS, 257packages; không sửa lock/dependencies. Lần sandbox đầu bị EACCES npm registry/cache; chạy có quyền mạng đã thành công |
| Prisma validate/generate, TypeScript build | PASS, Prisma7.10.0, Node24.21.0 |
| Backend Node tests | 92 PASS |
| Phase0/2 preservation Node tests | 104 PASS |
| Python tests | 14 PASS, gồm independent math cho output mới |
| Financial parity | 46/46 records, từng round, cả V9.1/V9.2; PARITY_RESULT.json |
| Live Prisma BusinessService | 13 PASS; INTEGRATION_LIVE_RESULT.json |
| Synthetic rollback | PASS, cả13bảng before=after=0 |
| Local production CLI startup | PASS, npm run start:prod, HOST0.0.0.0/PORTenv, live200, cleanupPASS |
| Local Nest real DEV readiness | live200/ready200, TLS1.3 verified, UTC; docs/phase1/live-health-verification.json |
| Dedicated runtime role/RLS | BLOCKED_ROLE_NOT_PROVISIONED, policies=[] được đọc từ database thật |
| Real Supabase actor JWT + runtime allowed/denied writes | NOT_VERIFIED; synthetic signed JWT tests không thay thế E2E |
| Multi-session PostgreSQL mutation race | NOT_EXECUTED; sequential stale-version/idempotency và rollback tests đã đạt |
| Supabase JWKS thực tế | HTTP200, 1 ES256 key; chỉ xác minh hạ tầng public key, chưa E2E user token |
| Render Phase3 build/runtime | NOT_DEPLOYED; health của deployment hiện có được kiểm tra riêng trong REMOTE_READONLY_RESULT.json |

Migration Phase2 đã APPLIED với checksum `148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93`, không thay migration SQL. Các blocker backup/TLS-preflight trước đó là evidence lịch sử, đã được owner override; không dùng chúng chặn Phase3. Catalog/73 checks Phase2 được giữ nguyên evidence, gồm giới hạn test nhiều session. Owner approval Phase3 xác nhận tiếp tục sau migration; không tự đổi test chưa chạy thành PASS.

## Baseline active24 tính từ records

| Measure | VND |
|---|---:|
| Paid | 144155159 |
| Unpaid | 25352082 |
| Refund eligible | 53288699 |
| Projected profit | 33059918 |

Không hardcode các tổng này trong engine. Legacy22 có aggregate riêng trong PARITY_RESULT.json. Nguồn HISTORY SHA256 giữ `b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db`; 46records/1224events/133snapshots/71properties được đọc/kiểm tra, chưa import. Báo cáo có per-round bucket/price/verification/issue và history checksum; các findings missing-price/unverified/conflict gốc giữ trong docs/phase0/SOURCE_BASELINE_VALIDATION.json.

## Discrepancies, giới hạn và phần chưa hoàn tất

1. Source tooltip về sales nói Nhận mẫu2; hàm getEndSellPriceSlot/getEndSellQtySlot chỉ chấp nhận End. Code chọn hàm thực tế, không thêm Sample sales routing.
2. Source dùng IEEE754 Number và không có currency rounding rõ ràng. Decimal engine tính chính xác, ví dụ0.1*0.2=>0.02 thay vì binary artifact0.020000000000000004. Không có discrepancy trên46 source records; đây là representation khác trên synthetic fractional case theo yêu cầu dùng Decimal, không sửa baseline.
3. Source normalizes legacy với số; TypeScript projection lưu decimal string để tránh mất precision. Raw JSON/types nguyên bản vẫn nguyên vẹn; parity so sánh semantic numeric values, không tuyên bố projection byte-for-byte giống Number serialization.
4. Whole financial baseline/round parity và selected mutation actions đã kiểm tra. Đã truy vết/port header sync sau mutation và Done snapshot/leave-enter sequencing; chưa chứng minh 100% Sheets-dependent UI snapshots/restore side-effects ở mọi stage. Đặc biệt source handleProgressChange bảo toàn received, nhưng onEdit gọi updateHeaderTotals/syncCurrentOrder91 có thể reset received=false hoặc re-activate cancellation ở Đặt có giá. Backend theo call chain thực tế, đã có source reference tests và live test; không silently fix source behavior, không chạy sync khi đọc history. Full workflow harness coverage còn thiếu nên chưa claim100% mutation parity.
5. Source không cung cấp cash refund ledger đầy đủ để suy ra partial actual refund từ refundQty/status. Actual refund metadata hiện read-only; chưa xây CRUD cash refund hoặc tự tính thực nhận. Product images metadata read-only, PIC reference edit đã có; upload/storage chưa làm.
6. Chưa có create/rename/archive product API. Enum classification chỉ phân loại source24/legacy22; không tự thêm loại mới hoặc sửa schema không được duyệt. Những API còn thiếu và business rules cho new records cần hoàn thiện trước full acceptance.
7. Role runtime thực tế chưa có; proposal NOLOGIN/RLS/grants cần approval riêng, kiểm thử login/TLS/policy/actor sau provisioning. Không cung cấp owner credentials cho runtime. Database users rỗng, chưa có real authorized actor. Không coi mock tests là runtime security PASS.
8. Multi-session race cần isolated fixture strategy đáp ứng rollback/cleanup; hiện chưa chạy. Transaction Serializable và unique/version protections có code và conflict mapping tests, chưa có multi-session runtime evidence.
9. npm audit đã xác minh4 high findings ở prisma/@prisma/config/deepmerge-ts/mysql2, cả audit đầy đủ và omit=dev; evidence trong DEPENDENCY_AUDIT.json. npm đề xuất downgrade Prisma6.19.3 (semver-major), không phù hợp stackPrisma7 đã duyệt. Không tự downgrade/override major hoặc audit fix --force. Cần review cách xử lý dependency trước security signoff; không tự kết luận không ảnh hưởng chỉ vì app dùng PostgreSQL.

Lần live integration đầu gặp check constraint vì numeric text được map TEXT kèm Decimal. Đã giữ INTEGRATION_FIRST_ATTEMPT.json, sửa mapping normalized state NUMBER và giữ raw TEXT; lần cuối13 testsPASS, toàn bộ rollback. Không sửa schema/migration để vượt lỗi.

Authoritative export không có Apps Script timezone. Các mutation cần tính lại status từ historical local date hiện trả409 SOURCE_TIMEZONE_REQUIRED thay vì coi date là missing hoặc tự gán UTC. Cần xác nhận setting timezone gốc để hoàn tất các workflow này; không yêu cầu export lại dữ liệu. New explicit dates/clock và boundaries24h/15d/30d đã kiểm thử.

## Bước cần owner duyệt riêng

Review `runtime-security-preview.sql`, SHA256 `7e74dfda6a062be22d0fe27d0cbaac99aeb4532f39112f4d4b0803bd6771eb5c`: role `tiktok_api_runtime` NOLOGIN/NOBYPASSRLS/non-owner; read grants13tables; mutable grants products/rounds/sales/requests; append-only history/snapshots với actor checks; không DELETE/TRUNCATE hoặc sửa managed schemas. Chưa tạo Prisma migration mới hoặc chạy proposal. Sau approval, chuyển proposal thành migration chính thức, review hash/SQL, apply theo phạm vi duyệt, provision LOGIN password qua kênh local/secret và owner-authorized users row; test runtime login/RLS/JWT trước bật BUSINESS_API_ENABLED. Giữ approval data import và deployment riêng.

Kết luận: **Phase3 PARTIAL, security acceptance BLOCKED**. Finance parity đạt; backend code và synthetic service integration đã có. Không Frontend/Phase4, không HISTORY import, không Sheets writes, không schema/RLS/role changes trong Phase3.
<!-- truonglt Phase3 actual implementation evidence end -->
