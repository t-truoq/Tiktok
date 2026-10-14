<!-- truonglt Phase4 owner-approved actual import signoff start -->
# HISTORY đã import và đối chiếu thực tế

Owner phê duyệt riêng qua tin nhắn “import luôn đi rồi chuyển qua phase tiếp theo”, sau đó xác nhận bật READ/WRITE trên Render. Các trạng thái NOT_IMPORTED/WRITE_DISABLED trong báo cáo ban đầu là bằng chứng lịch sử trước quyết định này.

Kết quả thực thi: **IMPORTED_VERIFIED**, Supabase DEV `nqdaykgasfnsaixkhbya`. Source SHA256 `b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db`; plan SHA256 `8b23dc52b2298ab195e26c09b7978ac216a3998badafc155b695b8707d0cbc69`. Checksum source trước/sau giữ nguyên. Prisma Serializable transaction tạo và đối chiếu toàn bộ rows/payloads/financial projection trước commit; không migration hoặc sửa auth/storage.

| Dữ liệu đã commit | Số lượng |
|---|---:|
| Products / legacy records | 46 / 46 |
| History events | 1.224 |
| Snapshots | 133 |
| Document Properties trong archive nguyên bản | 71 |
| Round projections / End sales | 80 / 31 |
| Legacy value/type slots | 25.428 |
| Source archive / import batch | 1 / 1 |
| Existing ADMIN user | 1, giữ nguyên |
| Mutation requests từ import | 0 |

Lần đầu gặp Prisma P2010 do `pg_advisory_xact_lock` trả kiểu `void`. Transaction rollback hoàn toàn; chẩn đoán READ ONLY xác minh source tables vẫn rỗng. Đã sửa cast kết quả lock sang `text`, giữ nguyên mapping/checksum plan, rồi thực hiện transaction thành công. `IMPORT_FIRST_ATTEMPT.json` giữ bằng chứng; không reset/resolve/drop/truncate hoặc sửa baseline để vượt lỗi.

Snapshot public data trước import lưu ở ignored `artifacts/phase4-pre-import-public.json`, ACL owner/SYSTEM. Đây là snapshot public data hiện có, **không** phải chứng nhận full Supabase backup/restore rehearsal; không chứa managed schemas hoặc role passwords. Source bytes/raw JSON/manifest/chunks được archive immutable để phục hồi nguyên bản. Không tự chạy destructive post-commit rollback.

`POST_IMPORT_RECONCILIATION.json` xác minh bằng real ADMIN JWT trên Render: list toàn bộ46, scope XLSX_MATCHED24, detail/rounds/sales/stages/history/snapshots HTTP200, anonymous401, readiness200/verifiedTLS/UTC. Active24: paid144155159, unpaid25352082, refundEligible53288699, projectedProfit33059918 VND. Không dùng mock JWT thay bằng chứng này. Token cũ hết hạn trả401 đúng; owner đã đăng nhập lại và lần kiểm tra cuối thành công.

Owner bật public writes, nhưng agent **không gửi mutation thật** để kiểm tra deployment. Bằng chứng positive write JWT/RLS vẫn là Phase3 real ADMIN loopback synthetic rollback; không gọi public write đã kiểm thử end-to-end trên dữ liệu vận hành. Phase5 bổ sung fail-closed legacy/archived guard, session capabilities và preview tài chính READ ONLY.

Phase4 importer/import/reconciliation và deployment revision `06c12e4e2dd06a4b5b1e4f793908185040fb1e61` có evidence thực. Phase5 tiếp tục frontend; không xóa history/legacy, không tự sửa giá hoặc findings. Owner yêu cầu không chạy lại test suite sau signoff; các thay đổi sau đó chỉ build và kiểm tra endpoint cần thiết.
<!-- truonglt Phase4 owner-approved actual import signoff end -->
