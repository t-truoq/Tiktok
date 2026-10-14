<!-- truonglt Gate1 verified owner exception start -->
# Gate 1 — PASS theo ngoại lệ owner

Ngày14/10/2026. Owner đã cho phép thay GitHubActions bằng CLI + Render thực tế do billing. Actions giữ **BLOCKED_BY_BILLING**, không ghi PASS.

| Điều kiện | Bằng chứng |
|---|---|
| Render checkout/build/runtime | Log owner: commit fa1f9eef0f70017bcc4b2584ba6e2058c9e3fc95, Node24.21.0, npmci --include=dev, build successful, npmrunstart:prod, service live |
| Staging live | HTTP200, status=ok; kiểm tra độc lập06:10:49UTC và06:12:28UTC (13:10/13:12 giờ Việt Nam) |
| Staging ready | HTTP200, database=ok, TLSv1.3, tlsScope=client-to-endpoint, timezone=UTC |
| CLI | Prisma validate/build PASS;17backend tests PASS; db:verify cả haiURL và local health:verify PASS |
| DEV/catalog | SELECT1/TLS/UTC/readOnly=on; publicObjects=[], chưa migration history |

JSON: GATE1_SIGNOFF.json, RENDER_READINESS_VERIFICATION.json, live-db-verification.json, live-health-verification.json. postgresSessionTls=false là phạm vi pooler-to-PostgreSQL riêng, không phủ định TLS client-to-endpoint đã kiểm tra; không tự đổi server TLS settings.

Không kết luận nguyên nhân các cảnh báo trước khi service live từ log thiếu chi tiết. Ready hiện đãPASS; không sửa arithmetic, không bypass certificate/hostname verification. Npm báo4high vulnerabilities cần review riêng; không chạy auditfix --force hoặc tự đổi phiên bản.

Gate1 cho phép tiếp tục **chuẩn bị Phase2**; không phải approval migration/import. Physical DB schema vẫn chưa được tạo. Gate2 cần migration được duyệt cùng live constraint/FK/RLS/transaction/rollback tests. Không frontend lúc này.
<!-- truonglt Gate1 verified owner exception end -->
