<!-- truonglt history export review start -->
# Đọc dữ liệu TikTok Affiliate HISTORY JSON

Nguồn: `TikTok_Affiliate_Phase0_References/references/TikTok_Affiliate_HISTORY_20261014_104638.json`.
SHA-256: `b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db`.
ExportedAt: 2026-10-14T03:46:38.068Z, tức 10:46:38 ngày 14/10/2026 giờ Việt Nam. Đã đọc toàn bộ properties, kiểm tra manifest/chunks/base64/gzip/JSON và lịch sử trên bản sao; file nguồn không đổi.

## Cấu trúc và số lượng

Format là `TIKTOK_AFFILIATE_DOCUMENT_PROPERTIES_EXPORT`, version1.0; khác envelope exporter đã viết trong project, không gọi validator envelope để kết luận file này hỏng.

| Nội dung | Số lượng |
|---|---:|
| Property entries | 71 |
| Product root keys | 46 |
| Chunks | 24 |
| Non-product key | 1: AFF_V91_SETUP_DONE |
| Raw JSON legacy records | 22 |
| Compressed schema9.1 records | 24 |
| Decode errors thực tế | 0 |
| Records khớp 24 tên sản phẩm trong XLSX | 24/24 |
| Records ngoài danh sách XLSX | 22 |
| History events của 24 sản phẩm XLSX | 1.186 |
| History events của 22 records khác | 38 |
| Stage snapshots của 24 sản phẩm XLSX | 123 |
| Purchase-state rounds của 24 sản phẩm XLSX | 72 |

`productCount=70` là 46 root keys + 24 chunk keys, không phải 70 sản phẩm độc lập. 48 entries trong invalidRecords đều là 24 manifest AFFZ91 và 24 chunk base64; sau decode, các record tương ứng đọc được. Không có bằng chứng 48 record hỏng. Records ngoài XLSX gồm tên cũ/biến thể và các key lỗi như #NAME?, #VALUE!, Totql; không xóa hoặc tự kết luận tất cả đều vô giá trị.

Raw records có purchaseState, stageData, history, priceMauN/priceEndN, sellEndN/qtySellEndN, PIC, currentProgress/currentDate, wholesale/qty/profit và image metadata. Có dynamic round3. History chứa END_PRICE_EDIT của phiên bản cũ (113 events trong nhóm active), cần bảo toàn event type này dù V9.1/V9.2 hiện không phát sinh cùng tên nữa.

## Đối chiếu sơ bộ bằng source nguyên trạng

Chạy các hàm ledger/refund/profit V9.1 và V9.2 nguyên trạng trong Node VM trên clones, cấm truy cập Sheets/Properties service; không sync từ sheet và không sửa raw record. Kết quả hai phiên bản bằng nhau cho 24 records.

| Metric tính từ record theo source | VND |
|---|---:|
| Đã thanh toán | 144.155.159 |
| Chưa thanh toán | 25.352.082 |
| Đủ điều kiện hoàn | 53.288.699 |
| Lợi nhuận dự kiến | 33.059.918 |

Các ô numeric P/Q/R/N đã có giá trị trong fixtures XLSX khớp kết quả source từng sản phẩm. Không gộp missing vào known zero: N của hàng15 (Apta new hỗ trợ tiêu hoá b.a 800g) và hàng24 (Aptamil NewZealand 5 mẫu h.a.i) đang blank trong XLSX, pure engine trả0; báo riêng BLANK_NOT_ZERO, chưa dùng để chứng nhận parity của nullable/display behavior.

Có 9 lượt mua active thiếu giá và 61 lượt active chưa verified. Thiếu giá ở các hàng XLSX3(sample1/end1),4(end1),5(sample1/end2),9(sample1),15(end1),16(end1),18(end3). Không suy ra giá từ tổng hoặc tự verify. Một số purchaseState issue có conflict giữa Đặt hiện tại và lịch sử Nhận; cần giữ flags khi migration.

## Giới hạn

- Active set được ghép theo snapshot XLSX, không có current row metadata trong JSON này để chứng minh sheet gốc hiện vẫn đúng 24 sản phẩm.
- File có sourceSpreadsheetId/export timestamp nhưng không có checksum do exporter nguồn cung cấp, timezone script/spreadsheet, runtime function fingerprints hoặc bằng chứng đọc ổn định giữa concurrent edits.
- Local source SHA và decoded SHA đã tính để truy vết bản nhận được; không chứng minh dữ liệu trước export chưa mất history.
- Đây là inspection và đối chiếu số sơ bộ, chưa là Gate0 sign-off/full reconciliation, chưa port finance engine và không import vào Supabase.

Chi tiết per-product/per-round oracle, history counts/event types và differences: `HISTORY_EXPORT_REVIEW.json`. Giữ file gốc và toàn bộ 22 records ngoài XLSX; không chỉnh Properties/Sheets/DB.
<!-- truonglt history export review end -->
