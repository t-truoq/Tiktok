<!-- truonglt Phase3.1 authorized real actor E2E interaction start -->
# Real actor E2E — một bước owner còn cần cung cấp

UUID `c918885f-c09c-40b0-a43a-4edcbdf69317` đã được owner duyệt ADMIN, xác minh tồn tại trong auth.users và provision public.users. Không tạo Auth user. Role runtime LOGIN/TLS/RLS đã được provision; BUSINESS_API_ENABLED vẫn false trong secret environment.

Workspace hiện không có access token thật hoặc Supabase Auth login credentials. Chỉ biết UUID không thể tạo chữ ký ES256 hợp lệ. Không dùng token giả/admin signing để thay E2E.

Owner có thể chạy trong terminal tương tác:

```powershell
& 'C:/Program Files/nodejs/node.exe' scripts/phase3/login-real-actor.cjs
```

Script hỏi publishable key và thông tin đăng nhập của đúng tài khoản đã duyệt. Password/email được nhập ẩn; token không in ra màn hình, không vào command history, được lưu tại `artifacts/phase3-real-actor.jwt` (ignored Git, ACL riêng). Nếu tài khoản chỉ dùng OAuth/MFA, hãy đăng nhập bằng flow đang dùng và tự lưu **access_token** của session hợp lệ vào file này; không gửi token qua chat. Không dùng service-role key hoặc refresh token làm Bearer JWT.

Sau khi token đã có, báo "token đã lưu". E2E harness sẽ xác minh JWKS thật, subject khớp UUID đã duyệt, HTTP auth/DTO/mutation cùng PostgreSQL RLS trong synthetic rollback, trước khi đánh dấu E2E PASS. Không bật public writes hoặc deploy từ helper login. Không gửi link/email hoặc tạo user mới.
<!-- truonglt Phase3.1 authorized real actor E2E interaction end -->
