<!-- truonglt Render Supabase CA trust report start -->
# Render TLS — Supabase Root CA 2021

Owner báo staging đã chạy NestJS nhưng readiness lỗi SELF_SIGNED_CERT_IN_CHAIN. Ảnh Dashboard mới cho thấy cấu hình cụ thể sai: Secret File có filename DATABASE_CA_CERT_PATH và Contents chỉ là /etc/secrets/supabase-ca.crt. Đây là file chứa một dòng đường dẫn, không phải CA; nó cũng không tạo environment variable DATABASE_CA_CERT_PATH.

## Sửa đúng hai mục riêng

1. Trong **Secret Files**, sửa entry cấu hình nhầm: Filename **supabase-ca.crt**, Contents là toàn bộ PEM trong local `apps/api/certs/prod-ca-2021.crt`, gồm BEGIN CERTIFICATE, các dòng Base64 và END CERTIFICATE. Không dán đường dẫn vào Contents, không dán password, không Base64 encode cả file thêm lần nữa.
2. Trong **Environment Variables**, tạo Key **DATABASE_CA_CERT_PATH**, Value **/etc/secrets/supabase-ca.crt** (không thêm dấu nháy). Không dùng đường dẫn Windows trên Render Linux; filename/case phải khớp.
3. Giữ DATABASE_URL/DIRECT_URL là Session Pooler DEV hiện có. Không bật NODE_TLS_REJECT_UNAUTHORIZED=0, sslmode=no-verify hoặc rejectUnauthorized=false. Không cần Supabase API secret key.
4. Save/rebuild/deploy revision mới; Start Command **npm run start:prod**, root directory để trống. Kiểm tra live/ready HTTP200, readiness database=ok/tls=true/timezone=UTC và protocolTLSv1.2 hoặc1.3.

Theo [Render Secret Files](https://render.com/docs/configure-environment-variables), file runtime nằm /etc/secrets/<filename>. CA có thể tải từ Supabase Dashboard Database Settings SSL Configuration theo [Supabase SSL docs](https://supabase.com/docs/guides/platform/ssl-enforcement); ưu tiên cùng CA đã xác minh local, không thay trust store toàn hệ thống.

## Chẩn đoán có bằng chứng

`CA_TRUST_COMPARISON.json`: cùng endpoint DEV, Node24 local default trust **FAIL SELF_SIGNED_CERT_IN_CHAIN**; thêm CA **PASS encrypted/authorized TLSv1.3**. Negative hostname test dùng standard Node verifier bị ERR_TLS_CERT_ALTNAME_INVALID. Không thực thi SQL trong phép so sánh này. Đây là kiểm chứng local Windows, không giả định đã đọc trust store/file bên trong Render Linux. Ảnh owner xác định riêng lỗi cấu hình Secret File trên Render.

CA local subject Supabase Root2021CA, CA=true, expires26/04/2031. Fingerprint SHA256:

`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

## Thay đổi và tests

Adapter PrismaPg dùng external pg.Pool. SSL object giữ rejectUnauthorized=true và servername; default Node hostname verification hoạt động. Theo [node-postgres SSL](https://node-postgres.com/features/ssl), connectionString có thể ghi đè SSL object. Code bỏ ssl/sslmode/sslcert/sslkey/sslrootcert/sslnegotiation/uselibpqcompat khỏi URL trước pg parse; ssl=0/false và các mode không an toàn bị từ chối. Không log URL/password/certificate contents.

- CA_FILE_NOT_FOUND: CA path unset cho Supabase hoặc file không tồn tại.
- CA_FILE_UNREADABLE: file không đọc được.
- TLS_CERTIFICATE_INVALID: PEM/CA/date không hợp lệ, chain không trusted, certificate expired hoặc hostname mismatch. Categories dùng trong sanitized logs; HTTP503 tiếp tục problem JSON không chứa credentials.
- Build và16backend tests PASS. Tests kiểm tra thiếu file, PEM sai, pg effective TLS config không bị URL ghi đè, safe categories và HTTP error redaction.
- db:verify hai URLs và health:verify realDEV PASS; live/ready200, UTC/TLSv1.3. Production start:prod smoke PASS, process cleanup PASS.

Không migration/db push/import hoặc business logic changes. GitHubActions vẫn BLOCKED_BY_BILLING. **Gate1 chưa PASS** cho đến khi staging sau khi cấu hình CA/deploy trả đủ haiHTTP200 và readiness contract hợp lệ.

Kiểm tra HTTP thực tế lúc05:26:35UTC sau push bản sửa b83696e: Render live200/status=ok, ready503/application/problem+json, lưu trong TLS_STAGE_HEALTH.json. Lần capture riêng sau đó không lấy được HTTP evidence, lưu REMOTE_GATE1_EVIDENCE.json. Chưa xác minh revision chạy trên Render hoặc CA file sau chỉnh cấu hình; không ghi readiness PASS.
<!-- truonglt Render Supabase CA trust report end -->
