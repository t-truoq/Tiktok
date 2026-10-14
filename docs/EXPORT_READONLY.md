<!-- truonglt export runbook start -->
# Export chỉ đọc từ Apps Script gốc

Owner đã xác nhận HISTORY JSON là Source of Truth ngày 14/10/2026. Runbook này giữ làm công cụ tham khảo; **không còn yêu cầu export lại** để nghiệm thu nguồn/Gate0. Quyết định ưu tiên nằm ở đầu blueprint và docs/GATE0_SIGNOFF.md.

## Cách chạy

1. Mở spreadsheet gốc → Extensions → Apps Script. Phải dùng project đang vận hành: Document Properties không chia sẻ giữa các project script.
2. Thêm file script mới, ví dụ `Phase0ExportReadonly`, dán nguyên nội dung `scripts/migration/legacy-export-readonly.gs`. Giữ nguyên toàn bộ script cũ; không thay `onEdit`, `onOpen`, CFG, trigger hoặc manifest của project.
3. Chọn hàm `exportAffiliatePhase0ReadOnly`, chạy thủ công và cấp quyền đọc spreadsheet/Properties, tạo file export mới trong My Drive. Không triển khai web app, không cài trigger cho exporter.
4. Execution log chỉ trả URL/id file mới, số sản phẩm, số lỗi, checksum, `exportComplete` và `reconciliationStatus`. Mở file JSON bằng URL đó, tải về và đặt vào `exports/` (được Git ignore).
5. Chạy `py scripts/migration/validate-export.py exports/<ten-file>.json`. Kết quả `INTEGRITY_PASS` chỉ xác minh toàn vẹn dữ liệu xuất, chưa xác nhận tiền/lịch sử đã đối chiếu với backend.
6. Nếu `exportComplete=false`, xem `payloadJson` → `problems`; không chạy repair/setup/recalculate để làm lỗi biến mất. Giữ file chẩn đoán, báo lỗi và export lại sau khi nguyên nhân được xem xét.

Nên chạy trong khoảng ít thao tác và không có người sửa sheet. Exporter giữ DocumentLock để tránh onEdit chạy đồng thời và kiểm tra lại dữ liệu sau khi đọc. Trigger hourly legacy không dùng lock; hai lượt kiểm tra không thay thế một snapshot transaction của cơ sở dữ liệu. Nếu phát hiện thay đổi, file vẫn được xuất để chẩn đoán nhưng không được dùng migration.

## Phạm vi được xuất

- Chỉ lấy root name không rỗng từ hàng >=3 của `Trang tính2`; khóa chuẩn đúng source: `AFF_PRODUCT_` + trim/lowercase/gộp khoảng trắng. Giữ tất cả dòng trùng và báo lỗi thay vì bỏ âm thầm.
- Chỉ đọc manifest và chunk đang được manifest của root đang hoạt động trỏ đến. Không đọc tất cả Properties, không xuất secret, không đọc stale product/obsolete chunk và không xóa chúng.
- Giữ nguyên chuỗi JSON sau decode, object raw, manifest, chunk value/key, SHA-256 từng chunk/manifest/decoded JSON, lịch sử và price slots không giới hạn tùy ý.
- Giữ A:S và mọi cột thực tế còn lại, kiểu giá trị, date UTC, display, formula, note, number format; giữ hàng 1/2 và toàn bộ grid. Bảo toàn riêng snapshot các tab `PAYMENT_AUDIT_V91_*`.
- Giữ metadata ảnh trong ô/ảnh neo trên grid và công thức IMAGE; ảnh nhị phân chưa được chuyển. XLSX gốc có 18 media entries phải được giữ nguyên để đối chiếu ảnh sau này.
- Ghi timezone của script và spreadsheet. Date text legacy `yyyy-MM-dd HH:mm:ss` không có offset được giữ nguyên; không tự giả định timezone khi đổi dữ liệu.
- Chạy các hàm tài chính/status đang có trong project trên bản sao JSON độc lập. Lưu riêng `oracle.normalizedCopy`, `normalizationChanged`, mode `LEGACY_RECORD_WITHOUT_SHEET_SYNC` và source/hash của các hàm oracle. Không sửa raw record bằng `ensureRecord`.
- Envelope chứa `payloadJson` là chuỗi nguyên văn và checksum SHA-256 UTF-8 của chuỗi đó. Validator xác minh chuỗi này, không hash lại object theo cách serialize khác.

## Điều không được chạy

Exporter không gọi `loadRecord`, `saveRecord`, `syncCurrentOrder91`, `updateHeaderTotals`, `auditPaymentSummary`, backup legacy, setup, finish-setup, migrate, repair, recalculate hoặc thay đổi trigger. Chỉ có một thao tác ghi đích: tạo file Drive JSON mới rồi đọc lại để xác minh checksum; không ghi cell/Properties vào nguồn và không thay sharing của file.

Nếu project gốc đã sửa logic so với hai file tham chiếu, fingerprint/source trong export giúp phát hiện sự khác biệt; chưa được mặc nhiên coi oracle là đúng với bản backup. Kiểm thử local dùng Node VM và mock dịch vụ Google. Chưa chạy trong Apps Script gốc nên vẫn cần nghiệm thu runtime thật, quyền truy cập, quota và đầy đủ dữ liệu sau khi xuất.

Tài liệu API đã kiểm tra: [Properties](https://developers.google.com/apps-script/reference/properties/properties), [Utilities](https://developers.google.com/apps-script/reference/utilities/utilities).
<!-- truonglt export runbook end -->
