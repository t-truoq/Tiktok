<!-- truonglt project readme start -->
# TikTok Affiliate — Phase 0/1

Đang bảo toàn/kiểm kê nguồn và dựng nền backend. Chưa có frontend, entity schema hoặc migration.

- docs/LEGACY_RULE_MAP.md: rules source, storage và các khác biệt với blueprint.
- docs/BASELINE_REPORT.md: inventory, dữ liệu còn thiếu và Gate0.
- docs/EXPORT_READONLY.md: cách chạy exporter trong Apps Script gốc.
- docs/PHASE1_REPORT.md: backend tests và Gate1 live connection.
- docs/phase0/: source hashes, đủ function names/lines, full diff, workbook typed cells/media/diagnostics.
- tests/golden/: chỉ XLSX observations; authoritativeExpected=null khi chưa có Properties export.

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

GitHub workflow chỉ thực hiện offline validation/mocked HTTP; không được gọi là live DB pass. CI thực tế và staging chưa chạy; Gate1 local pass chưa phải toàn bộ gate. Financial baseline/reconciliation chỉ được nghiệm thu sau export gốc đầy đủ. Không cần project DEV mới.
<!-- truonglt project readme end -->
