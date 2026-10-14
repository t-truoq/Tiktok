<!-- truonglt legacy rule map start -->
# Quy tắc V9.1/V9.2 đã kiểm kê

Đã đọc toàn bộ hai file `.gs` và TXT trong `TikTok_Affiliate_Phase0_References/references/`. Danh mục đủ 111 hàm V9.1 và 113 hàm V9.2, kèm số dòng: `phase0/FUNCTION_INVENTORY.md`. SHA-256 và call scan: `phase0/source-inventory.json`. TXT trùng V9.1 sau chuẩn hóa CRLF/LF, không trùng byte. Không sửa source.

## Khác biệt hai phiên bản

Full diff lưu tại `phase0/v91-v92.diff`; phần ngoài diff giữ nguyên.

- `updateHeaderTotals` (V9.1:1349/V9.2:1352): V9.2 đọc A:O theo arrays, dùng `affiliateRowFromArraysV92`, ghi P:R theo nhóm dòng kề nhau và Q:R notes theo batch; fallback từng dòng khi native Table từ chối. Không thay P notes sản phẩm. V9.1 ghi outputs trong loop; V9.2 đợi tính xong danh sách rồi mới ghi outputs, nhưng vẫn có saveRecord trong sync loop. Khác biệt failure timing, không có transaction toàn sheet.
- `saveRecord` (2297/2390): V9.2 dùng `setProperties(chunkProperties,false)` thay setProperty từng chunk. Codec/key/manifest và cleanup chunks cũ không đổi.
- Thêm `verifyAffiliateV92ReadOnly` (3442): read-only với record đã loadRecord/normalize, kiểm tra paid+unpaid=incurred khi missing=0 bằng tolerance0.000001; không kiểm tra parity với cell/history đầy đủ, bỏ duplicate như totals. invalid=0 không chứng minh migration đúng.
- CFG.VERSION/schemaVersion vẫn là9.1; V9.2 không phải storage schema mới.

## Identity và workflow

Hàm: normalizeText, normalizeRootName, getStorageKey, getRootName, getCurrentProgress, normalizeProgress, parseAffiliateStage, isSample1, isSample2, isReceivedSample, isEndProgress, hasAffiliateStage, stageExists91, getAffiliateProgressRank, isEnd1FlowRequired, validateFlow, handleRootName, handleProgressChange, initializeStage, restoreStage.

- Root key: `AFF_PRODUCT_` + trim/lowercase/gộp whitespace. Không bỏ dấu hoặc Unicode-normalize. handleRootName tải record tên đích nếu có, nếu chưa thì tạo mới; không move key/history cũ hoặc chặn duplicate. Totals/audit bỏ các dòng duplicate sau dòng đầu. Duplicate protection trong blueprint là yêu cầu mới cần thiết kế, không phải source đã có.
- Parser chấp nhận Đặt/Nhận mẫu hoặc sample/End không phân biệt case, gộp whitespace; N safe integer dương không leading zero; empty=null, Done={done:true,label:Done}, invalid throw. Round key sample:N/end:N. getAffiliateProgressRank vẫn fixed N1/2, không điều khiển ledger động.
- Chuyển Đặt: ordered=true,cancelled=false, không trực tiếp undo received. Chuyển Nhận: received=true; thiếu Đặt thì ordered=true,verified=false,issue. LEAVE_STAGE chỉ ghi progress cũ tránh snapshot ô stage mới; ENTER_STAGE ghi snapshot mới. Chọn lại stage vẫn append ENTER_STAGE, không dedupe.
- initializeStage dùng date hiện tại, PIC group/N; xóa H/I/L/M và nạp slots đúng round. restoreStage dùng PIC slot/snapshot, date snapshot hoặc hiện tại, nạp slots độc lập. Done không nạp/xóa field như round thường. Clear progress xóa date rồi save, không xóa history.
- validateFlow chỉ toast khi refundQty1+End1, không chặn và không được gọi trong flow hiện hành. isEnd1FlowRequired/old rank không được dùng để giới hạn ledger vào hai round.

## Tiền, sales và profit

Hàm: isNumericMoney, toMoney, amount91, getPaymentPurchaseConfigs, getPurchaseLedger, getPaymentSummaryForRecord, getSampleTotal, getEndBuyTotal, getEndSellRevenue, getEndSellQtyTotal, getRefundEligible91, calculateProjectedProfit, updateProfitForRow, getOrderStagePurchaseAmount, didOrderStageOccur, didReceiveStageOccur, getPaymentPurchaseConfigsLegacy, getHistoryStageAmount, getStrictOrderedStageValue.

- Source dùng JS Number, không có rounding policy. Reject negative/nonfinite/boolean/null/undefined/exact empty; string whitespace thành0, scientific notation được nhận, dấu phẩy không nhận. Regression test ghi nhận quirks, chưa sửa. Backend nghiệp vụ phải dùng Decimal sau parity/precision review.
- Config rounds là union purchaseState keys, stageData/history/currentProgress hợp lệ và priceMauN/priceEndN có amount; sort Sample trước End rồi N tăng. Price slot riêng lẻ không tự bật ordered trên schema9.1.
- Ledger ordered=state.ordered&&!cancelled; received=ordered&&state.received; không incurred → amount0/NOT_INCURRED, ordered thiếu amount → null/MISSING_ORDER_PRICE, còn lại PAID/UNPAID theo received. verified chỉ khi ===true.
- Summary cộng paid/unpaid độc lập, cùng incurred/sampleTotal/endTotal; missing/review chỉ active ordered. Zero là known price, khác missing. Cancelled không cộng tiền/missing/review.
- Refund: mỗi active received EndN ghép active ordered SampleN; Sample không cần received. Có amount thì cộng, thiếu giá/không khớp thì missing++. Không phải actual cash refunded, không dùng cột S.
- Pure profit = toMoney(wholesale)×(Number(qty)||0) + tổng sellEndN×qtySellEndN active ordered End − End incurred; wholesale/sales/qty thiếu dùng doanh thu0 theo legacy. End chưa received vẫn có projected sales/cost. Sample cost không trừ, giả định được hoàn.
- updateProfitForRow đọc J/K, normalize amount91; hasMoney nếu có J/K hoặc ordered purchase có giá hoặc End sold qty>0. Không có input → N blank/profit null, khác pure profit0. Giá Sample cũng kích hoạt hasMoney. Rollup row2 tính pure profit chứ không trực tiếp sum N.
- Helper strict historical amount chỉ phục vụ repair: snapshot Đặt ưu tiên, rồi latest numeric value ở history Đặt. Không dùng để tự sửa export.

## Edits, snapshots và history

Hàm: handlePriceEdit, handleEndPriceEdit, editBuy91, getPriceSlot, getEndBuyPriceSlot, getEndBuyWriteSlot, getEndSellPriceSlot, getEndSellQtySlot, handleSellEndEdit, handleSellEndQtyEdit, handlePicEdit, handleDateEdit, saveCurrentRow, restoreRecord, finalizeUserEdit, buildSnapshot, snapshotStage, recordStageSafe91, appendHistory, syncCurrentOrder91, selectedStage91, changeSelectedStage91, verifySelectedAffiliateStage91, markSelectedUnreceived91, cancelSelectedAffiliateStage91, restoreSelectedAffiliateStage91.

- Buy chỉ sửa tại Đặt cùng group/N. Nhận/Done/wrong group: restore slot vào cell rồi throw. Valid blank lưu null nhưng ordered vẫn true/cancelled=false trên schema9.1 → missing, không tự cancel.
- End sales/qty chỉ End slot, dù toast cũ nói nhập ở Nhận mẫu2; invalid sales value ghi null, không throw như buy.
- PIC picMauN/picEndN; date chỉ nhận Date object. Snapshot: progress,pic,date,price,endPrice,sellEnd,sellEndQty,refundQty,status,wholesale,qty,profit,note,capturedAt. stageData giữ latest snapshot mỗi label, history giữ nhiều event.
- saveCurrentRow cập nhật name/progress/date/refundQty/status/wholesale/qty/note/pic,state,snapshot,image,profit; không ghi buying price từ Nhận cell, không lưu field riêng S. finalizeUserEdit save row rồi append event snapshot.
- History append {type,progress,timestamp,data}, không truncation. Không actor,before/after,requestId,idempotency,optimistic version; không fabricate trường lịch sử thiếu khi migration.
- Event types: LEAVE_STAGE, ENTER_STAGE, PRICE_EDIT, PIC_EDIT, DATE_EDIT, REFUND_QTY_EDIT, END_BUY_PRICE_EDIT, END_SELL_PRICE_EDIT, END_SELL_QTY_EDIT, STATUS_EDIT, NOTE_EDIT, FIELD_EDIT, AUTO_STATUS, VERIFY_STAGE, CORRECT_UNRECEIVED, CANCEL_STAGE, RESTORE_STAGE.
- syncCurrentOrder91 chỉ Đặt+numeric displayed price; blank không overwrite. Giá khác hoặc state thiếu/not ordered/cancelled/received → ordered=true,received=false,cancelled=false. Existing verified=true giữ true; thiếu/false có issue. Totals có thể undo received khi đứng Đặt! Exporter không sync.
- Verify cần ordered+numeric giá, xóa issue. Unreceived đặt received=false,verified=true,issue empty. Cancel/restore toggle cancelled, append history→save→totals→audit. Totals sync có thể re-activate cancelled khi current stage là Đặt có numeric giá. Ghi nhận, không sửa logic trong Phase0.

## Status, thời gian và màu

Hàm: calculateStatus, refreshStatusForRow, checkAffiliateStatus, refreshAllAffiliateStatus, isFinalRefundStatus, isOutOfStock, passedHours, hoursBetween, daysBetween, dateToISO, isoToDate, serializeDate, formatDate, statusResult, extractRemainingDays, colorStatusCell, styleStatus.

- Done→Hoàn tất; Đặt→Chờ nhận mẫu/EndN. Sample received thông thường >=24h→Có thể đặt lượt tiếp theo, chưa đủ/không Date→Chờ đủ1ngày.
- End received giữ Đã hoàn/Chưa hoàn, thiếu Date→Chờ check hoàn; >=15 elapsed days→Cần check, chưa đủ→Chờ check.
- Sample received+note token hết hàng (boundary whitespace hoặc . , ; :) giữ final refund; thiếu Date→thiếu ngày; remain=ceil(30-daysBetween); <=0 cảnh báo, còn lại integer countdown.
- daysBetween=elapsed ms/86400000, không calendar day. dateToISO là text local yyyy-MM-dd HH:mm:ss theo script timezone, không UTC ISO/offset; isoToDate dựng local components. Export giữ text và timezone gốc.
- Final status không được bảo vệ toàn cục: Sample không hết hàng, Đặt và Done có thể overwrite final manual status. Đây là khác biệt với blueprint cần duyệt trước correction.
- refreshStatus chỉ append AUTO_STATUS nếu status đổi và saveHistory=true. Hourly check gọi false: đổi status cell nhưng không ghi record/history, không lock. Có thể lệch cell và record.

| Nhánh màu | Background / font | Bold |
|---|---|---|
| Cần check, Chưa hoàn, 2 warning End1; countdown<=7 | #F4CCCC / #990000 | Có |
| Countdown>7 | #FFF2CC / #7F6000 | Có |
| Có thể đặt mẫu2, prefix Có thể đặt End1/2 | #FCE5CD / #B45F06 | Có |
| Chờ đủ1ngày, check hoàn, hết hàng thiếu date | #FFF2CC / #7F6000 | Không |
| Chờ nhận mẫu1/2, prefix Chờ nhận End1/2 | #D9EAF7 / #134F5C | Không |
| Đã hoàn, Hoàn tất | #D9EAD3 / #274E13 | Có |

Màu reset default trước apply. Generic Có thể đặt lượt tiếp theo/Chờ nhận mẫu3 không có màu riêng; prefix End1/2 cũng match End10/20. Không tự sửa để khớp UX mới.

## Document Properties

Hàm: createEmptyRecord, ensureRecord, lastBuyEdit91, findStage91, saveRecord, loadRecord.

- Empty record: name,schemaVersion9.1,stageData{},history[],purchaseState{},currentProgress/currentDate empty,refundQty/wholesale/qty/profit null,note empty; dynamic slots phát sinh theo edits.
- Raw JSON V9 hoặc `AFFZ91|version|parts|size`; version UUID bỏ hyphens lấy12hex; key chunk `<root-key>__<version>_<index-zero-based>`. JSON.stringify→gzip UTF-8→standard base64→chunks<=7300chars,<=150parts. size là base64 string length, không JSON byte length. Nguồn không có checksum.
- Ghi chunks mới→switch manifest→delete old-version chunks; manifest failure cleanup new chunks; chunk-write failure có thể để orphan. Exporter chỉ đọc active manifest/chunks, không dọn dữ liệu.
- loadRecord decode rồi ensureRecord; vì vậy loadRecord không trả raw original nguyên trạng. Normalization chỉ RAM nếu không save. Exporter decode độc lập, giữ raw JSON/record trước, normalize clones sau.
- ensureRecord bổ sung stageData/history/purchaseState trước; schema9.1 return, không infer missing state từ history.
- Pre9.1: progressDates thành stageData nếu thiếu; infer order/receive từ snapshots/events/currentProgress. Latest buy edit ưu tiên, sau đó snapshot Đặt, Sample snapshot Nhận, active slot hoặc Sample slot; End không lấy giá Nhận không có bằng chứng Đặt.
- Latest explicit blank edit trước receipt có thể ordered=false (khác schema9.1 blank edit). Không xóa history/price slot của canceled-cleared round. Current Đặt trái lịch sử Nhận→conflict,received=false. Inferred round verified=false,cancelled=false và issue; schemaVersion9.1. Không thay raw bằng normalized copy.

## Sheet I/O và triggers

Hàm đọc/mapping: readRow, affiliateRowFromArraysV92, getMainSheet. Hàm cell writes: loadPrice, loadNumber, setCell, setIfExists, stylePaymentSummary, ensureAffiliateSummaryColumns, applyAffiliateHeaders. Ảnh: saveImageToRecord ưu tiên formula, còn lại chỉ string/number; ảnh object/over-grid không được lưu đầy đủ. restoreImageFromRecord ghi formula/value.

- onEdit chỉ installable trigger, đúng tab,row>=3,một hàng, lock wait5s/finally release; một hàng paste nhiều cột vẫn chỉ dispatch cột đầu. Default saveCurrentRow, không history event riêng.
- onOpen tạo menu; không coi các menu action đều read-only.
- updateHeaderTotals/recalculatePaymentSummary sync và có saveRecord, ghi P:R cho unique rows; row2 A=sample+end incurred,B=Total,H=Sample,I=End,K=sampleqty,M=Endqty,N=profit,P=paid,Q=unpaid,R=eligible. Bỏ duplicate/empty, có thể insert summary columns/header.
- auditPaymentSummary tạo tab mới PAYMENT_AUDIT_V91_<MMdd_HHmmss>[_suffix],11columns per round; refund product lặp mỗi round, không sum audit K. Missing record dùng zeros diagnostic không chứng minh known price0. Audit là snapshot, không full event history.
- repairAffiliateFinancialData có thể đổi/xóa priceEnd1/2, delete endPrice, sync fields và write Properties/cells/totals. migrateAffiliateLayout move/insert columns/header/totals. Không chạy.
- setupAffiliateAutomation preflight→migrate active records→sheet/audit/setup flag→delete/recreate onEdit/hourly triggers. finishAffiliateSetupWithoutMigration91 vẫn sửa triggers/setup Properties. Không chạy.
- preflightAffiliateV91 read qua normalized loadRecord/toast/log. backupAffiliateV9Properties91 copy/insert sheets, set backup property, xuất tất cả Properties. Không dùng làm exporter chỉ đọc.
- previewAffiliateV91RootFix không persist nhưng sync/infer bản copy, khác raw ledger; verifyAffiliateV92ReadOnly cũng không thay thế per-product parity. Không dùng hai hàm này để chứng nhận raw export.

## Workbook và gate còn thiếu

24 sản phẩm,3sheet,18media. Main có cột S Nhận tiền hoàn ngoài CFG A:R, phải giữ riêng. Audit mới nhất67detail rows,9thiếu giá,63cần đối soát; audit cũ63rows,9thiếu giá,63cần đối soát. Chỉ là trạng thái snapshot, chưa mặc nhiên là trạng thái Document Properties hiện tại.

P/Q/R row2 khớp tổng observed product cells bằng Decimal, chưa đối chiếu record. N có2blank, pure profit/hasMoney khác nhau; M product cells đều blank nhưng M2=2 có thể đến từ historical End slots. Không sửa hoặc infer round từ totals.

Gate0 chưa đạt: chờ export gốc, fingerprints/timezone, per-product/per-round expected và history count/date/mismatch report. Regression inputs trong tests là synthetic, không giả làm golden baseline sản phẩm thật. Không conversion trước provenance.
<!-- truonglt legacy rule map end -->
