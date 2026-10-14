<!-- truonglt baseline report start -->
# Báo cáo baseline Phase 0

Ngày kiểm tra: 14/10/2026, Asia/Ho_Chi_Minh. Báo cáo này thay bản kiểm kê ban đầu khi chưa có references.

## Kiểm kê nguồn thực tế

Thư mục: `TikTok_Affiliate_Phase0_References/references/` (không phải references ngay tại root). Đã đọc toàn bộ blueprint, hai Apps Script và TXT, đọc toàn bộ cells/formulas/type trong XLSX qua OOXML chỉ đọc.

| File | Bytes | Hàm global |
|---|---:|---:|
| Tiktok_Affiliate_V9.1_Original_Backup.gs | 70.443 | 111 |
| Tiktok_Affiliate_V9.2_Optimized.gs | 74.685 | 113 |
| Pasted text(20261014-015629).txt | 73.784 | 111 |
| Tiktok affiliate.xlsx | 3.124.692 | — |

SHA-256 từng file và function/line/call inventory: `phase0/source-inventory.json`. TXT chỉ khác newline CRLF so với LF V9.1. Full V9.1/V9.2 diff lưu riêng. Không thay file gốc.

## Workbook

| Sheet | Hàng OOXML có entry | Ý nghĩa |
|---|---:|---|
| Trang tính2 | 35 | 24 sản phẩm ở hàng 3–26; header hàng 1, rollup hàng 2; các hàng/ô ngoài sản phẩm được giữ |
| PAYMENT_AUDIT_V91_1012_102124 | 68 | 67 dòng snapshot per-round |
| PAYMENT_AUDIT_V91_1011_015721 | 64 | 63 dòng snapshot per-round trước |

Audit không phải toàn bộ event history. Refund eligible của sản phẩm được lặp ở từng dòng round, không được sum trực tiếp audit column K. Snapshot mới nhất có 9 dòng thiếu giá đặt và 63 dòng cần đối soát; snapshot cũ cũng có 9 thiếu giá và 63 cần đối soát. Chưa kết luận current Properties vẫn giống snapshot.

Mapping source A:R:

| Cột | Field |
|---|---|
| A | Tên sản phẩm |
| B | Hình ảnh |
| C | SL đơn hoàn |
| D | Tiến độ |
| E | PIC |
| F | Ngày |
| G | Status |
| H | Giá Sample |
| I | Giá mua End |
| J | Giá bán sỉ Sample/đv |
| K | SL Sample bán |
| L | Giá bán End/đv |
| M | SL bán End |
| N | Profit |
| O | Ghi chú |
| P | Tổng tiền đã thanh toán |
| Q | Tổng tiền chưa thanh toán |
| R | Tiền đủ điều kiện hoàn |

Workbook thêm S “Nhận tiền hoàn”, source không map riêng field này. Exporter bảo toàn S và tất cả cột thực tế, không gộp S vào refund eligibility. Các media entries: 18; chưa xác minh ảnh binary liên kết đúng sản phẩm. Tất cả style IDs/formulas/raw value được giữ trong workbook inventory; không recalculate hay sửa workbook.

Kiểu dữ liệu OOXML: text shared strings, numeric, blank; F là serial numeric với style date, không đủ thông tin timezone. A2 là text chứa số, không tự đổi typed number. Formula inventory có 9 nodes (gồm shared formula followers), master N27=(J27*K27)-I27 nằm ngoài 24 sản phẩm có tên; không dùng làm domain oracle. Monetary/qty numeric của sản phẩm có phần lẻ .0 trong snapshot, nhưng chưa quyết định precision cho historical slots vì chưa có Properties.

## Fixtures/quan sát đã tạo

- `tests/golden/baseline-input.json`: toàn bộ 24 product rows, raw typed cells, formulas, source hash; kind XLSX_OBSERVATIONS_ONLY.
- `tests/golden/baseline-expected.json`: các ô observed N/P/Q/R/S từng sản phẩm, authoritativeExpected=null, verifiedAgainstLegacyEngine=false. Không gọi các số này là expected đã chứng minh.
- `phase0/workbook-inventory.json`: toàn bộ 3 sheet và metadata/media hashes.
- `phase0/workbook-observations.json`: duplicate check và Decimal sum diagnostics. Không có duplicate normalized names trong 24 rows snapshot.

Row2 P=144.155.159, Q=25.352.082, R=53.288.699 VND khớp tổng observed product cells; N=33.059.918 khớp tổng 22 ô N đã biết, còn 2 ô blank. Đây chỉ là kiểm tra nội bộ snapshot. M2=2 nhưng M sản phẩm hiện đều blank; không mặc nhiên mismatch vì row2 có thể aggregate historical End slots. Không tự thay blanks bằng known zero và không infer per-round data từ totals.

## Exporter chỉ đọc

`scripts/migration/legacy-export-readonly.gs` và hướng dẫn `EXPORT_READONLY.md` đã tạo. Đọc active roots từ sheet → manifest/chunks đúng source → decode JSON nguyên văn → SHA-256; giữ raw record/history/price slots, riêng oracle copies và function source/hash. Kiểm tra lại grid/Properties/audit để phát hiện thay đổi khi xuất. Chỉ tạo một file Drive JSON mới; không viết cell/Properties/trigger hoặc gọi legacy setup/repair/audit/recalculate/sync.

Validator `scripts/migration/validate-export.py` kiểm tra envelope/chunks/decoded text/raw object/history count. INTEGRITY_PASS không phải money/history reconciliation pass. Chưa chạy exporter trên Apps Script gốc vì chưa có connected original script session hoặc export do owner chạy.

## Kết quả kiểm thử Phase 0

| Nhóm | Kết quả |
|---|---|
| Node: source behavior + V9.1/V9.2 parity trên regression inputs synthetic | PASS |
| Node: raw/chunk exporter, checksum, source write traps, duplicate, invalid/missing/corrupt/unstable paths | PASS |
| Hai nhóm Node tổng cộng | 35/35 PASS |
| Python: envelope tamper, Unicode/raw-byte preservation, record/history integrity, incomplete export | 5/5 PASS |
| XLSX inventory/typed fixtures | Chạy thành công; không sửa nguồn |
| Real Apps Script export/runtime/quota | CHƯA CHẠY |
| Per-product/per-round financial parity, raw history completeness/date parity | CHƯA CHẠY |

Synthetic tests được ghi rõ ở file test; không giả làm fixtures sản phẩm production. Pure source đang dùng Number được chạy nguyên trạng làm regression oracle; chưa port/adapt Decimal để thay đổi hành vi.

## Gate 0: CHƯA ĐẠT

Source inventory/rule map/exporter/local tests đã hoàn thành. Còn thiếu export Properties thật, xác minh fingerprint/timezone project gốc, golden expected từng sản phẩm/round, history count/latest dates và reconciliation report. Số mismatch với hệ thống thật chưa xác định, không phải 0. Không chuyển đổi/import trước khi dữ liệu được xác minh.

Phase1 chỉ làm nền backend độc lập theo chỉ đạo mới; xem `PHASE1_REPORT.md`. Project Supabase supplied đã được owner xác nhận là đang vận hành; kết nối direct chưa thành công, chưa có DEV riêng/staging. Không entity/migration/Frontend.
<!-- truonglt baseline report end -->
