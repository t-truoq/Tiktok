# Phase 2 — review và kiểm thử trước import

Ngày 14/10/2026. Trạng thái: **OFFLINE PASS; Gate 1 chưa PASS toàn bộ; Gate 2 chưa nghiệm thu**.
Không thực thi SQL preview, db push, migration hoặc import. Schema API đang hoạt động vẫn không có entity nghiệp vụ. HISTORY JSON và các file nguồn không bị sửa.

## Kết quả review schema và SQL

Prisma validate và migrate diff từ empty datamodel tới file schema đều PASS offline. Diff chỉ sinh văn bản SQL; chưa kiểm chứng SQL tùy chỉnh bằng PostgreSQL.

| Điểm kiểm tra | Bổ sung trong bản đề xuất |
|---|---|
| Idempotency nguồn | Source SHA unique; batch source+mappingVersion unique, planSha256 bắt buộc |
| Quan hệ nguồn | FK composite buộc LegacyRecord thuộc đúng batch/source và đúng product/legacyKey |
| History/snapshot | Imported history phải có batch+index+payload, actor giữ unknown; snapshot unique product+batch+JSON pointer; FK composite phải có LegacyRecord cùng product/batch |
| Refund | FK composite kiểm tra đúng product và đúng SAMPLE/END; không tạo khoản tiền hoàn thực nhận từ eligibility |
| Decimal/state | CHECK NUMBER tương ứng Decimal khác SQL NULL; blank/null/missing/text giữ raw và state, không coerce text thành số |
| Indexes | Bổ sung FK indexes cho batch, actor và hai refund rounds; unique compound hỗ trợ truy vấn/import retry |
| Immutability | Chặn UPDATE/DELETE và TRUNCATE trên archive, raw records/values, history, snapshots |
| RLS/grants | Bật RLS 13 bảng, không có policy client; revoke PUBLIC/anon/authenticated/service_role trên các bảng và hàm trigger |

Các FK do Prisma sinh mặc định có ON UPDATE CASCADE; không được thay đổi identity/primary key tại runtime. Các FK composite bổ sung dùng ON UPDATE RESTRICT. Các constraint SQL tùy chỉnh phải được giữ trong migration được review; không dùng db push để thay thế.

RLS không chặn table owner/superuser/BYPASSRLS và không áp dụng cho TRUNCATE. Vì vậy postgres chỉ dùng cho kiểm tra DEV/migration được duyệt; runtime nghiệp vụ cần role riêng với grants được review và kiểm thử thật. Revoke service_role không có nghĩa một role có quyền quản trị không thể tự cấp lại quyền. Xem [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Kiểm thử bảo toàn dữ liệu

- 102/102 Node tests, 13/13 Python tests; backend build và 12/12 backend tests PASS local.
- Persist plan qua JSON rồi khôi phục HISTORY **đúng từng byte**, 89.338 bytes; SHA-256 nguồn vẫn `b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db`.
- Reconciliation kiểm tra 46 product identities (24 matched, 22 legacy), 1.224 events đúng thứ tự, 133 snapshots, purchaseState, raw decoded text, manifest/chunks, types và V9.1 projections. V9.2 vẫn được đối chiếu bằng bộ golden hiện có.
- Preflight xét 10.006 financial slots trên raw records, snapshots và history; 4.694 numeric slots được đối chiếu Decimal độc lập bằng Python, không rounding hoặc overflow. Lưu raw payload cho cả các trường history không phải slot tài chính đặt tên; không ép toàn bộ history vào Decimal.
- null, blank, missing, zero, numeric text, negative và fractional values có kiểm thử riêng. MISSING không có raw member; JSON null dùng Prisma.JsonNull khi triển khai, không nhầm DbNull. Decimal serialize thành string, round index BIGINT serialize thành string.
- Dynamic rounds hỗ trợ đến giới hạn safe integer V9.1, không giới hạn số vòng cố định. Round chưa có purchaseState trong legacy được giữ trong raw/calculation projection, không tự tạo verified hoặc trạng thái nguồn.
- Node/Python cùng phát hiện dữ liệu bị sửa: record/event/snapshot/state/price/projection và archive. Node còn kiểm tra plan hash ngay cả khi payload hash bị tính lại vẫn phải khớp nguồn pinned.

Evidence: `OFFLINE_VALIDATION.json`, `INDEPENDENT_ROUNDTRIP.json`. Plan có raw dữ liệu được sinh vào `artifacts/preservation-plan.json` (Git ignored); không upload plan lên CI artifact.

## Idempotency, transaction và rollback

Reference contract nằm trong `scripts/phase2/preservation.cjs`, **chỉ mô phỏng bộ nhớ**, chưa có DB adapter/import CLI. Một batch identity là sourceSha256+mappingVersion; payload hash khác với batch đã tồn tại trả conflict, payload giống trả kết quả cũ. History dùng original index, snapshot dùng escaped JSON pointer. Không merge product theo tên gần giống.

DB implementation sau phê duyệt phải reserve batch, insert archive/records/children, reconcile target và commit trong một transaction; xử lý unique collision bằng đọc kết quả batch đã commit. Một mapping version mới không được tự nhân đôi dữ liệu cùng archive: phải review kế hoạch thay đổi trước. Unique source/key là lớp bảo vệ cuối, không dùng ON CONFLICT để âm thầm cập nhật raw/history.

Offline fault injection tại cả 46 vị trí đều để lại zero committed records; 8 retry đồng thời có đúng một commit mô phỏng. Điều này chưa chứng minh isolation/locks/deadlock handling của PostgreSQL. Cần live integration tests trước import thật.

Lỗi trước COMMIT: rollback transaction, không để batch/child rows dở dang. Lỗi sau COMMIT: không DELETE immutable archive/history. Phải restore backup trước import vào database cô lập, kiểm tra checksum/counts/financial reconciliation rồi phê duyệt chuyển đổi. Việc này không yêu cầu tạo lại Supabase DEV hiện có. Backup/restore thực tế và quyền thực hiện chưa được kiểm chứng.

## Rủi ro dữ liệu còn nguyên

11 trường hợp thiếu giá; 69 active orders chưa verified; 2 trạng thái chưa verified nhưng chưa phát sinh/đã hủy; 1 current ORDER xung đột RECEIVE history. Các tập có thể giao nhau. Danh sách có tên/pointer trong `docs/phase0/SOURCE_FINDINGS.csv`. Không sửa giá, trạng thái hoặc lịch sử để làm khớp tổng.

Timestamp nguồn thiếu timezone/actor tiếp tục giữ text và NULL UTC/actor. 22 legacy chỉ có normalization trong calculation projection; không dùng projection thay raw. Hai nhóm 24/22 có rollup riêng; không tự thay đổi phạm vi dashboard cũ.

## Điều kiện nghiệm thu còn thiếu

1. Gate 1: CI run thật thành công và backend staging đã triển khai kết nối DEV bằng TLS được xác minh, SELECT 1, UTC; lưu URL run, revision và health evidence. Chưa có Git remote/staging target trong workspace.
2. Sau Gate 1 PASS: trình kế hoạch migration DEV cụ thể để phê duyệt. Chưa trình lệnh áp dụng hoặc chạy migration lúc này.
3. Sau phê duyệt schema: re-inspect DEV/schema, kiểm thử migration SQL thật, FK/check/unique, role/grants/RLS, CRUD, version conflicts, concurrent idempotency, immutable history và transaction rollback. Giữ kết quả từng phép thử.
4. Trước import riêng: approve source/mapping hash, backup có restore rehearsal, dry-run toàn bộ 46/1.224/133, reconcile từng raw payload/type/financial slot và V9.1/V9.2. Có DB implementation và integration tests PASS, không chỉ mô phỏng.
5. Sau import được phê duyệt: target reconciliation zero unexplained differences, export target round-trip phục hồi nguyên file và giữ source archive; báo cáo đầy đủ legacy/missing/unverified/conflict, không tự làm sạch.

Không coi offline PASS là Gate 2 PASS. Không tạo frontend trước backend/database nghiệm thu.
