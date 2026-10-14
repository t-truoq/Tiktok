<!-- truonglt Phase3 verified field/service/DTO mapping start -->
# Mapping Phase 3

| Source | Database / preservation | Engine/service | API |
|---|---|---|---|
| name/storage key | Product rootName/legacyKey; LegacyRecord rawJsonText/rawJson immutable | Hydrate product identity; no rename/merge | Product detail/list |
| wholesale | Product wholesale + sourceFieldStates runtimeRecord; original legacy slots | amount; sample revenue wholesale*qty | EDIT_FIELDS.wholesale |
| qty | Product sampleSalesQuantity + raw/projection states | source signed qty coercion for legacy calculation; validated new stored quantity | EDIT_FIELDS.qty |
| refundQty | Product refundQuantity + raw/projection states | Preserved quantity, not monetary cash refund | EDIT_FIELDS.refundQty |
| priceMauN/priceEndN | PurchaseRound orderPrice + orderPriceState; sourceFieldStates holds representation | EDIT_BUY/getPurchaseLedger | Current stage EDIT_BUY.value |
| purchaseState sample:N/end:N | PurchaseRound flags/rawState/issue | ordered&&!cancelled; received=>paid; verified preserved | Round detail; stage actions |
| sellEndN/qtySellEndN | SalesDetail unitPrice/soldQuantity, rawFields | Active ordered End sales revenue, regardless received flag | EDIT_SALES |
| currentProgress | Product stage label/group/BIGINT index | parseStage / SET_STAGE | progress string |
| currentDate/progressDates | Product currentDateText; immutable source snapshots/date text | Explicit clock; no invented UTC for old local text | EDIT_FIELDS.date requires timezone |
| status/note | Product currentStatus/note plus runtime projection | 24h,15d,30d/final status logic | EDIT_FIELDS |
| stageData | LegacyRecord preserved source; new StageSnapshot append-only | Mutable calculation copy separate from immutable snapshots | GET snapshots only |
| history | LegacyRecord raw history; ProductHistory indexed imported events/new append-only events | source sequence untouched; new event before/after/actor/request/operation | GET history only |
| picMauN/picEndN/pic | Source image refs/raw stage copy; Product.pic; ProductImage metadata | Current round PIC reference editing | EDIT_FIELDS.pic; GET images |
| source document properties | SourceArchive bytes/properties and LegacyRecord chunks/text | Read-only Phase3 | Archives metadata only |
| source classification | Product XLSX_MATCHED/LEGACY_UNMATCHED | Scope chosen explicitly by filter | classification query |
| actualRefundData | Refund.actualRefundData preserved JSON | No invented source formula for actual refund money | GET refunds only |

Missing/null/blank/zero remain distinct in raw/sourceFieldStates. PurchaseRound/SalesDetail constraints require NUMBER when a normalized Decimal is populated; a numeric text's original TEXT state/value is retained in sourceFieldStates/rawFields. This mapping was validated by live synthetic integration after the first implementation exposed the constraint mismatch; migration SQL was not changed. New Decimal inputs exceeding schema scale/precision are rejected, never silently rounded.

Raw 22 legacy records never become overwritten normalized source. `normalizeRecord` works on structuredClone; runtimeRecord stores editable business projection while immutable archive/legacy/history remains untouched. Legacy aggregate is separate from active24 and never silently excluded from the default database summary.
<!-- truonglt Phase3 verified field/service/DTO mapping end -->
