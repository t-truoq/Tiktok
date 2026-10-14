<!-- truonglt phase2 database acceptance tests start -->
# Phase 2 — kiểm thử PostgreSQL sau phê duyệt

Chỉ chuẩn bị test cases; **không có runner tự kết nối/ghi DB**. Gate1 ngoại lệ chưa nghiệm thu; migration/import chưa được duyệt. Dùng synthetic records, không sửa source46. Thực thi test trong transaction rồi rollback khi được phép; không disable immutable triggers để dọn dữ liệu.

| Nhóm | Test / kết quả bắt buộc |
|---|---|
| Migration | Generated SQL và custom constraints review cùng nhau; migrate deploy trên DEV sauapproval, retry không thay schema; không db push |
| Index/version | Round0, negative, >9007199254740991 hoặc version0 bị23514; BIGINT serialize string giữ đúng miền V9.1 |
| Decimal/state | zeroNUMBER lưu0.00, NULL/BLANK/MISSING không thành0; text giữraw; overflow/extra scale bị preflight chặn vì PostgreSQL cast có thể round |
| FK nguồn | Wrong batch/source hoặc product/key bị23503; history/snapshot không có LegacyRecord cùngproduct/batch bị23503 |
| Refund FK | Cross-product/wrong SAMPLE-END bị23503; không fabricate actualRefundData |
| Unique/idempotency | Duplicate source/batch/product/round/event/pointer bị23505; concurrent retry đúng một commit; khác plan hash trảconflict |
| Immutable | UPDATE/DELETE/TRUNCATE source/raw/history/snapshot bị55000 với role có SQL quyền tương ứng; client roles thiếugrant bị42501 |
| RLS | Catalog RLS13tables, role attributes/grants thực tế; client không đọc/ghi; runtime không postgres/superuser/BYPASSRLS |
| Transaction | Inject lỗi sau parent/round/từng history-child và trướcCOMMIT: zero partial rows, batch chưaCOMMITTED; retry thành công |
| Concurrent edit | UPDATE theoid+expectedVersion, tăngversion: đúng một success/một409, không duplicateaudit |
| Audit | Domain change + before/after + actor/reason/request + idempotency outcome cùngtransaction; legacyactor/time unknown giữ nguyên |
| Restore | Backup restore môi trường cô lập; exactbytes/hash/type/46/1224/133 và financeV9.1/V9.2 parity, nhóm24/22 riêng |

Preview RLS không có policy nên **backend non-owner cũng bị deny**. Không giải quyết bằng dùng postgres/BYPASSRLS. Sau Gate1+approval cần role runtime riêng, policies chỉ dành role này và grants tối thiểu; backend vẫn enforceADMIN/EDITOR/VIEWER. Migration/import role tách runtime; runtime chỉSELECT nguồn bất biến. Policy/grant SQL chưa được apply hoặc giả định đã hoạt động.

SQLSTATE trên là expected outcomes, chưa phải kết quả thật. Với import đãCOMMIT, không DELETE history/source: restore rehearsal và chuyển đổi cần approval riêng. Không tự disabletriggers/truncate hoặc tạo bảng trênDashboard.
<!-- truonglt phase2 database acceptance tests end -->
