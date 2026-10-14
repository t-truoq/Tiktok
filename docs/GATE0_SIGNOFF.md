<!-- truonglt gate0 acceptance start -->
# Gate 0 — ĐẠT theo quyết định Source of Truth mới

Ngày 14/10/2026. Owner xác nhận nguyên bản HISTORY JSON là nguồn dữ liệu chuẩn. Đây là nghiệm thu kỹ thuật baseline cho nguồn đã được chấp nhận, không phải phê duyệt import/migration hoặc xác nhận mọi lượt mua đã được verified.

## Điều kiện nghiệm thu

| Điều kiện | Bằng chứng / kết quả |
|---|---|
| Nguồn cố định, không sửa | SHA-256 b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db; checksum test đạt |
| Account toàn bộ Properties | 71 entries = 46 root records + 24 chunks + 1 setup property; không orphan/missing chunk |
| Bảo toàn đủ sản phẩm | 46/46, phân loại 24 XLSX_MATCHED + 22 LEGACY_UNMATCHED; không delete/merge/archive |
| Raw JSON/type/presence nguyên trạng | Decoded text/SHA và deep typed equality trên 46 record; null/blank/zero/numeric text/missing khác nhau |
| Toàn bộ history/stageData/purchaseState | 1.224 events, 133 snapshots; giữ thứ tự, payload, hashes, trạng thái verified và presence/absence của purchaseState |
| V9.1 chuẩn, V9.2 đối chiếu | 46/46 normalized calculation copies và per-round/payment/refund/profit outputs bằng nhau; 0 parity mismatch |
| Kiểm tra độc lập | Python decoder/type comparison và Decimal math đạt cho 46 record; không sử dụng source JS để tính Decimal |
| Kiểm thử corruption/error | Thiếu/orphan chunk, base64/size/gzip lỗi, null→blank, xóa legacy record/history, sai golden amount đều bị phát hiện |
| Kiểm thử local cuối | 89/89 Node (gồm 2 guard tests cho Phase2 offline proposal); 11/11 Python |
| Findings đầy đủ | SOURCE_BASELINE_VALIDATION.json, SOURCE_FINDINGS.csv; giữ nguyên và không coi missing=0/verified=true |

Independent Decimal kiểm tra finance trên normalized calculation copy do V9.1 tạo; normalization itself được so sánh với V9.2, không tuyên bố Python đã độc lập triển khai mọi migration heuristic của ensureRecord.

Không yêu cầu export lại Google Sheets. XLSX không override JSON, chỉ cung cấp classification/reference. Timestamp text không có timezone giữ nguyên, UTC historical fields chưa được suy diễn; actor/before-after/request IDs lịch sử thiếu không được fabricate.

## Findings cần giữ khi migration

| Nhóm | 24 khớp XLSX | 22 legacy | Tổng |
|---|---:|---:|---:|
| Lượt active thiếu giá trong oracle | 9 | 2 | 11 |
| Lượt active chưa verified trong oracle | 61 | 8 | 69 |
| Record cần ensureRecord normalization để tính | 0 | 22 | 22 |

Với legacy, missing/unverified đến từ V9.1 calculation projection (DERIVED_V91_ONLY). Không tự tạo purchaseState hoặc sửa slots gốc theo projection đó. Các trạng thái/issue gốc vẫn là Source of Truth; future relational mapping phải có raw preservation và nêu rõ derived fields.

Một conflict đã ghi rõ: `Sữa bột Aptamil Profutura Úc 900g Chính Hãng | Số 1 - 2 - 3 - 4`, round end:2 — current Đặt End2 nhưng có lịch sử Nhận End2; state hiện received=false/verified=false và issue giữ nguyên. Không tự đổi thành đã nhận/đã thanh toán.

Ngoài 11+69+1 findings trên, báo cáo ghi 71 issue text từ source/projection (có chồng lấp với missing/unverified). Không cộng thành số record lỗi riêng. Toàn bộ 22 legacy, gồm các tên #NAME?, #VALUE!, Totql và tên cũ/biến thể, đều được bảo toàn như owner yêu cầu.

Thêm 2 round chưa verified nhưng NOT_INCURRED thuộc 24 XLSX_MATCHED, được báo riêng UNVERIFIED_NOT_INCURRED. Không tính chúng vào review=69 của active ledger nhưng cũng không bỏ flags khỏi migration baseline. Tổng các loại finding có chồng lấp là 154, không phải 154 sản phẩm lỗi.

## Metrics theo V9.1, chia theo classification

| Metric (VND) | XLSX_MATCHED | LEGACY_UNMATCHED projection |
|---|---:|---:|
| Paid | 144.155.159 | 9.138.000 |
| Unpaid | 25.352.082 | 10.973.998 |
| Refund eligible | 53.288.699 | 0 |
| Projected profit | 33.059.918 | 11.800.000 |

Không tự cộng legacy vào dashboard hiện tại hoặc coi refund eligible là tiền nhận hoàn. Chính sách scope của dashboard sẽ phải rõ ràng ở API/UX; mọi 46 record vẫn có mặt trong DB theo proposal. Historical amounts/status/notes trong payload không bị thay bằng derived metrics.

## Gate tiếp theo

Gate0 kỹ thuật đạt theo source decision; source acceptance và findings-preservation không phải approval ghi DB. Gate1 local đã pass, staging/CI thực tế chưa có. Đã chuẩn bị Phase2 offline (schema/map/SQL preview), không thay schema API đang chạy, không import, không migrate Supabase. CRUD/rollback/concurrent edits/restore của Gate2 chưa chạy.
<!-- truonglt gate0 acceptance end -->
