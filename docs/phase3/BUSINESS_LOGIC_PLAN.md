<!-- truonglt Phase3 future business logic mapping start -->
# Phase 3 — kế hoạch engine V9.1

Chỉ planning; chưa port engine hoặc thêm business endpoints. Dependency: Gate2 physical schema/integration tests đạt. SourceV9.1 là chuẩn; V9.2 dùng parity, không diễn giải lại công thức.

| Source function | Module/contract dự kiến | Tests bắt buộc |
|---|---|---|
| parseAffiliateStage | stage parser/labels/groups/index; Done và dynamic positiveN | aliases,blank/invalid,safeintegerlimit,không hardcodeN=2 |
| getPaymentPurchaseConfigs | phát hiện rounds từ raw stage/price/state/history | orphan prices,stageData/history-onlyrounds; không fabricate purchaseState |
| getPurchaseLedger | ordered&&!cancelled, received=>paid; missing price kháczero | independentpaid/unpaid, cancelled/unreceived, verified flags/issue |
| getPaymentSummaryForRecord | independent rollups/missing/review | all46golden, nhóm24/22 riêng, không đổi dashboard scope để ép khớpXLSX |
| getRefundEligible91 | receivedEndN khớp orderedSampleN | unmatched/missing/cancelled, eligibility khác actual cashrefund |
| calculateProjectedProfit | wholesale*qty + activeEndsales - Endcost | Decimal exact; negative/blank/missing/zero và qty, không làm sạchsource |
| calculateStatus | timing24h/15d/30d, final/manualstatus preservation | explicitclock/timezone, exactboundaries, nguyên localdate text thiếutimezone |
| editBuy91 + mutations | isolate decisions khỏi SheetsIO; order price thuộcĐặt đúnground | blank edit khác version, không Nhận overwriteĐặt, stage navigation giữslots/history |

Đầu tiên pureTypeScript engine không DB/HTTP/SheetsIO. RawLegacyRecord immutable; V9.1ensureRecord chỉ clone tính toán, không overwrite22legacy. Decimal dùng representation đã preflight, giữ Number coercion quirks của baseline bằng tests; không round để đạt parity. So sánh per-product/per-round với golden V9.1 vàV9.2; độc lập Python Decimal kiểm tra sau normalization projection, không gọi đó là independent normalization port.

Sau pureengine parity, services transaction: validateinput/actorrole/version/idempotency, readcurrent, computepatch, UPDATEtheoid+expectedversion, appendbefore/after/actor/time/reason/request, lưuMutationRequestoutcome cùngtransaction. Conflict409, identicalretry trảoutcome cũ, khácpayloadhash409; failure rollback không appendhistory dởdang. Không tựverify/cancel/restore hoặc sửa sourcefindings.

Derivedcache/rollup cập nhật cùngtransaction, backend là nguồn tính toán; frontend sau backend/database nghiệm thu. Gate3 cần all46parity, synthetic mutation/error/timeboundary/concurrency tests và reconciliation không có unexplaineddifferences. Import46records và bật business writes cần approval/phân quyền riêng, không gắn vào startup.
<!-- truonglt Phase3 future business logic mapping end -->
