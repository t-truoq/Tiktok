<!-- truonglt Phase3 API contracts start -->
# Phase 3 API

All routes below use `/api/v1`. Bearer JWT is required; issuer is the owner-confirmed Supabase project, audience/role `authenticated`, ES256 or RS256 with JWKS signature verification. The database `users` row supplies ADMIN/EDITOR/VIEWER; JWT metadata cannot elevate business roles. No user auto-provisioning endpoint exists.

Business READ API remains disabled unless `BUSINESS_API_ENABLED=true` and a separately provisioned `RUNTIME_DATABASE_URL` passes the non-owner role check. Writes additionally require BUSINESS_WRITE_ENABLED=true; Phase4 public writes remain false. Never reuse postgres migration/health credentials for that variable. Readiness currently verifies infrastructure database health, **not business runtime authorization**.

| Method | Path | Access/behavior |
|---|---|---|
| GET | `/products` | Authenticated list/filter/sort/pagination |
| GET | `/products/:id` | Product, rounds/sales and computed financial detail |
| GET | `/finance/summary` | Consistent transaction rollup; no default XLSX/legacy exclusion |
| GET | `/products/:id/sales` | Paginated End sales details |
| GET | `/products/:id/stages` | Alias immutable snapshots |
| GET | `/products/:id/rounds` | Rounds and sales, read-only |
| GET | `/products/:id/snapshots` | Immutable snapshots, read-only |
| GET | `/products/:id/history` | Immutable history, read-only |
| GET | `/products/:id/refunds` | Preserved eligibility/review/actual metadata, read-only |
| GET | `/products/:id/images` | Preserved image metadata, read-only |
| GET | `/products/:id/legacy` | Preserved legacy records, read-only |
| GET | `/source-archives` | Metadata only; no source bytes/download/import |
| GET | `/import-batches` | Metadata only; no import action |
| POST | `/products/:id/mutations` | ADMIN/EDITOR; transaction/version/idempotency/audit |

Product list/summary query: `page=1`, `limit=25` (max100), `sort=rootName|createdAt|updatedAt|currentStatus`, `direction=asc|desc`, `status`, `classification=XLSX_MATCHED|LEGACY_UNMATCHED`, `archived=true|false`, `search`. Product detail IDs are UUIDs. All subresources support page/limit/direction and deterministic sorting. Rounds filter group/roundIndex/ordered/received/cancelled/verified and sort roundIndex/group. History filters eventType/stageLabel and sorts recordedAt/legacyEventIndex. Snapshots filter sourceLabel and sort createdAt/sourceLabel. Legacy filters importBatchId. Refunds/images sort createdAt. Metadata lists support page/limit/direction; archives filter filename/sha256, batches filter status/sourceArchiveId. Unknown query fields are rejected.

Amounts and BIGINT round indices serialize as strings, avoiding precision loss. Responses are `Cache-Control: no-store`. `payment.missing` and `review` describe incomplete/unverified ledger entries; totals do not fabricate missing prices.

Example mutation, header `Idempotency-Key: order-price-request-0001`:

```json
{"expectedVersion":3,"operation":"EDIT_BUY","values":{"value":"12.34"},"reason":"Owner price edit"}
```

Operations:

| Operation | values | Source rule |
|---|---|---|
| SET_STAGE | `progress` | Blank/Done/Đặt/Nhận mẫu or End N; dynamic safe integer |
| EDIT_BUY | `value` | Current Đặt stage only; blank clears price; no auto-verify |
| EDIT_SALES | `unitPrice`, `quantity` | Current End stage only; omitted field unchanged |
| EDIT_FIELDS | `wholesale`, `qty`, `refundQty`, `note`, `status`, `date`, `pic` | Local dates use Asia/Ho_Chi_Minh; raw historical local timestamps are retained |
| VERIFY_STAGE | empty object | Ordered and valid price required |
| CORRECT_UNRECEIVED | empty object | Received false, verified true, issue cleared |
| CANCEL_STAGE | empty object | Sets cancelled flag, preserves price/history; source header sync reactivates a priced current Đặt stage |
| RESTORE_STAGE | empty object | Restores cancellation flag, preserves received/verification |

Successful mutation returns product `id`, incremented `version`, `requestId`, and `finance`. Repeating the same actor/key/payload returns the stored outcome. Reusing a key with another payload yields409. A transaction failure leaves no partial product/round/sales/history/snapshot/request writes.

Source interaction: handleProgressChange itself preserves received while viewing Đặt, but onEdit then calls updateHeaderTotals/syncCurrentOrder91, which resets received=false when the current Đặt price is valid. The same header sync can reactivate cancellation at a priced current Đặt stage. Backend follows the whole source call chain; it does not silently fix this source behavior. Historical/raw records are never resynchronized automatically by reads.

Owner-confirmed timezone is Asia/Ho_Chi_Minh. Source local dates are interpreted centrally in this IANA timezone; ISO timestamps with offsets preserve the instant. Raw source timestamp text is retained. Invalid/ambiguous calendar input is rejected. Grouped edits follow source column sequencing, with per-step audit; snapshot observed profit is distinct from current derived finance.

Codes: 401 AUTH_REQUIRED/INVALID_TOKEN; 403 FORBIDDEN/ACTOR_NOT_PROVISIONED; 404 PRODUCT_NOT_FOUND/ROUND_NOT_FOUND/RESOURCE_NOT_FOUND; 409 VERSION_CONFLICT/IDEMPOTENCY_CONFLICT/IDEMPOTENCY_IN_PROGRESS; 400 INVALID_DTO/UNKNOWN_FIELD/INVALID_VERSION/INVALID_STAGE/INVALID_MONEY/DECIMAL_NOT_REPRESENTABLE/BUY_REQUIRES_ORDER_STAGE/SALES_REQUIRES_END_STAGE/EXPLICIT_TIMEZONE_REQUIRED; 503 BUSINESS_API_DISABLED/UNSAFE_RUNTIME_ROLE/RUNTIME_SECURITY_NOT_VERIFIED/AUTH_KEYS_UNAVAILABLE/BUSINESS_DATABASE_UNAVAILABLE.

Owner-deferred: new product creation/rename/archive, upload/storage workflow, refund cash editing, source import, user provisioning and public immutable history edits. Creation classification needs an explicit design because the current enum only describes XLSX-matched/legacy-unmatched source records. No cash refund formula is invented from refundQty or status.
<!-- truonglt Phase3 API contracts end -->
