<!-- truonglt Phase4 REST integration contract start -->
# REST cho React

Base URL `https://tiktok-6kwu.onrender.com/api/v1`. G?i `Authorization: Bearer <access_token>` c?a Supabase Auth th?t. Business role l?y t? public.users; anonymous401, actor ch?a provision403. Kh?ng Swagger UI; contract b?ng t?i li?u n?y v? docs/phase3/API.md. API ch? ??c khi BUSINESS_API_ENABLED=true, BUSINESS_WRITE_ENABLED=false.

| GET path | Response |
|---|---|
| /products | {page,limit,total,items}; classification/status/search/archived filter, sort/direction |
| /products/:id | Product + rounds/sales + derived finance |
| /products/:id/rounds | Paginated purchase rounds, include sales |
| /products/:id/sales | Paginated sales with round group/index |
| /products/:id/stages | Alias snapshots, kh?ng di?n gi?i l?i source stage |
| /products/:id/snapshots | Immutable snapshots |
| /products/:id/history | Immutable ordered history |
| /finance/summary | Decimal totals; filter classification/status/search/archived |
| /products/:id/refunds | Eligibility/review metadata, kh?ng inferred cash refund |
| /products/:id/images | Source metadata; kh?ng upload |
| /products/:id/legacy | Immutable legacy metadata/raw projection |
| /source-archives | Source metadata, kh?ng original bytes/download |
| /import-batches | Import metadata, kh?ng trigger import |
| /health/live | {status:ok}, kh?ng c?n JWT |
| /health/ready | DB/TLS/UTC readiness, kh?ng c?n JWT |

IDs UUID; roundIndex v? m?i Decimal/BIGINT ???c serialize th?nh string. Dates instant ISOUTC, source local text ri?ng v? timezone Asia/Ho_Chi_Minh. Cache-Control no-store. Product detail/resource nonexistent404; unknown field/filter400. Resource pagination default25/max100, page1; fields/sorts whitelist trong docs/phase3/API.md. sales sort=id/direction, stages d?ng sourceLabel/createdAt. T?t c? d? li?u d?ng runtime role/RLS; kh?ng d?ng postgres owner CRUD.

POST /products/:id/mutations hi?n403 BUSINESS_WRITES_DISABLED ngay sau authentication/authorization, tr??c DTO/service/transaction; kh?ng c? public import endpoint ho?c create/rename/archive. FE kh?ng t? t?nh authoritative money ho?c g?i actor_id. L?u l?i {code} ?? hi?n th? ti?ng Vi?t; HTTP status quy?t ??nh auth/retry/conflict.

Database hi?n ch?a c? HISTORY: authenticated list total0 v? summary0 l? k?t qu? ??ng. Active24 totals ch? ???c x?c minh offline; kh?ng tr?nh b?y ch?ng nh? s? li?u ?? import/live. CORS theo owner t?m ch?a b?t, c?n c?u h?nh URL Vercel exact origin khi n?i browser frontend.
<!-- truonglt Phase4 REST integration contract end -->
