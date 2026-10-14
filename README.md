<!-- truonglt project readme start -->
# TikTok Affiliate — Gate1 đạt, Phase2 chuẩn bị

Owner đã xác nhận HISTORY JSON là Source of Truth. Gate0 đạt cho46records; Gate1 PASS_OWNER_EXCEPTION với Render build/staging live-ready200/TLS1.3/UTC và CLI. Schema chính13models và migration chính thức đã chuẩn bị offline, chưa apply/import/Frontend. Xem docs/phase1/GATE1_SIGNOFF.md và docs/phase2/DEV_MIGRATION_PLAN.md.

- docs/LEGACY_RULE_MAP.md: rules source, storage và các khác biệt với blueprint.
- docs/BASELINE_REPORT.md: inventory, dữ liệu còn thiếu và Gate0.
- docs/EXPORT_READONLY.md: cách chạy exporter trong Apps Script gốc.
- docs/PHASE1_REPORT.md: backend tests và Gate1 live connection.
- docs/phase0/: source hashes, đủ function names/lines, full diff, workbook typed cells/media/diagnostics.
- tests/golden/baseline-input.json và baseline-expected.json: 46 raw records và V9.1 oracle, đối chiếu V9.2.
- tests/golden/xlsx-observed-*.json: snapshot XLSX tham khảo, không override Source of Truth.
- docs/GATE0_SIGNOFF.md: checksum, preservation, independent tests và findings đầy đủ.
- docs/phase2/: schema/mapping/SQL preview chưa áp dụng.

Node24/npm, Python3 và Git cần có trên PATH. Với máy hiện tại: dùng C:\Program Files\nodejs\npm.cmd, thêm C:\Program Files\nodejs vào PATH của phiên để npm tìm node.

## Các lệnh local

    npm.cmd ci
    py scripts/phase0/inventory.py
    npm.cmd run test:phase0
    py -m unittest discover -s tests/phase0 -p "*_test.py"
    npm.cmd run prisma:validate
    npm.cmd run build
    npm.cmd run test:phase1
    npm.cmd run start:api

Project nqdaykgasfnsaixkhbya được owner xác nhận là DEV. Hai route Session Pooler local đã SELECT 1/UTC và TLS socket được xác minh; live/ready HTTP200 với DB thật. Chạy npm.cmd run db:verify và npm.cmd run health:verify để lặp lại kiểm tra. Khi DB không sẵn sàng, live vẫn200 và ready503. Không dùng db push/migrate hoặc setup/repair legacy trong Phase0/1.

GitHubActions BLOCKED_BY_BILLING, không ghiPASS; owner đã xác nhận ngoại lệ CLI+Render. Workflow automatic tạm ngừng, manualCI còn cần private fixture provisioning vì HISTORY không còn trong checkout mới. Không cần project DEV mới hoặc export lại Sheets. Source/Gate1 approval không phải migration/import approval.
<!-- truonglt project readme end -->
