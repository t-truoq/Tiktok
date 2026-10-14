<!-- truonglt gate1 owner exception report start -->
# Gate 1 — ngoại lệ CI theo quyết định owner

14/10/2026. **Chưa đủ điều kiện đề xuất nghiệm thu**. GitHub Actions: **BLOCKED_BY_BILLING**, không phải PASS. Owner cho phép CLI và Render độc lập; chưa có Render build/readiness PASS.

| Kiểm tra | Kết quả / bằng chứng |
|---|---|
| Prisma validate / generate / TypeScript build | PASS CLI |
| Node source/preservation tests | 102/102 PASS; test evidence mới 1/1 PASS (tổng103) |
| Python independent tests | 13/13 PASS |
| Backend unit/HTTP tests | 13/13 PASS, gồm production host binding |
| db:verify hai URLs | PASS thực tế04:48:25–04:48:27UTC; SELECT1, UTC, clientTLSv1.3, transaction readOnly=on; publicObjects=[], chưa _prisma_migrations |
| health:verify NestJS local + DEV thật | live/ready HTTP20004:48:28UTC; database=ok, UTC, TLSv1.3 |
| Render live/ready | Timeout; chưa quan sát HTTP status/JSON. curl xác minh DNS/TCP/TLS handshake hoạt động, không suy diễn root cause |
| Render build/deployed revision | Chưa có dashboard/API/log evidence; không có browser session/API key/deploy hook được cấu hình |
| GitHub Actions | [Run38512835618](https://github.com/t-truoq/Tiktok/actions/runs/38512835618): job không khởi chạy, steps=[], account locked due to billing |

Evidence: `live-db-verification.json`, `live-health-verification.json`, `REMOTE_GATE1_EVIDENCE.json`. TLS client-to-pooler không đồng nghĩa TLS pooler-to-PostgreSQL; postgresSessionTls=false được ghi đúng phạm vi.

## Thay đổi source/Git

- `746d42c`: offline schema constraints/FK/indexes và preservation/independent tests.
- `2e14350`: CI/container/read-only staging verifier và Render setup reference. Cả hai đã push main.
- `8c37bac`: production binding, cập nhật blueprint ngoại lệ owner, CLI DB/health evidence và bỏ HISTORY khỏi HEAD mới. Đã push main; staging sau push vẫn chưa có HTTP/JSON evidence.
- Production host mặc định0.0.0.0, development127.0.0.1, HOST override giữ nguyên. Sửa portability đã được kiểm thử; **chưa xác nhận là nguyên nhân Render timeout**.
- Tạm bỏ automatic Actions triggers theo owner, giữ workflow_dispatch sau billing recovery.
- HISTORY JSON giữ nguyên local, loại khỏi index/HEAD mới; file đã có trong lịch sử remote trước theo phê duyệt công khai. Không tự force-push/rewrite lịch sử. Golden fixtures đã công khai vẫn chứa dữ liệu theo phê duyệt trước.
- Env/certs/private keys/artifact plan vẫn ignored; kiểm tra Git không thấy credential files hoặc secret key thật. Không sử dụng Supabase secret API key.
- HISTORY không còn trong fresh checkout. Trước khi khôi phục manual CI đầy đủ cần cấp fixture nguồn từ kênh riêng; không lấy file từ lịch sử Git để vượt quyết định loại trừ mới. Render build chỉ dựng backend, không cần HISTORY.

## Owner cần thực hiện

Deploy branch main vào **service Render hiện có** theo `OWNER_RENDER_SETUP.md`: root monorepo, đúng build/start, DEV Session Pooler env và CA Secret File; không pre-deploy migration/import. Gửi revision/trạng thái build và logs đã loại credentials để xử lý lỗi cụ thể. Không cần gửi credentials lên chat.

Chỉ sau Render build PASS và live/ready PASS có evidence mới đề xuất Gate1 nghiệm thu theo ngoại lệ. CI tiếp tục BLOCKED_BY_BILLING. Chưa chuyển active schema, tạo migration chính thức hoặc ghi DB. Phase2 chỉ chuẩn bị offline; backup/restore và role grants thật chưa được chứng minh.
<!-- truonglt gate1 owner exception report end -->
