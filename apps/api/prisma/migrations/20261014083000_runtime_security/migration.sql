-- truonglt Phase3.1 owner-approved runtime security migration start
-- Security-only: no business entities, source data or managed schemas changed.
BEGIN;
DO $$ BEGIN
  IF current_setting('server_version_num')::int < 160000 THEN
    RAISE EXCEPTION 'PostgreSQL 16+ required for explicit role membership options';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('tiktok_api_access','tiktok_api_runtime')) THEN
    RAISE EXCEPTION 'Runtime roles already exist; review instead of overwriting';
  END IF;
  IF (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace
      AND c.relkind='r' AND c.relname<>'_prisma_migrations') <> 13 THEN
    RAISE EXCEPTION 'Baseline table count mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
      WHERE c.relnamespace='public'::regnamespace) THEN
    RAISE EXCEPTION 'Unexpected preexisting business policies';
  END IF;
END $$;
CREATE ROLE tiktok_api_access NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE tiktok_api_runtime NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT tiktok_api_access TO tiktok_api_runtime WITH INHERIT TRUE, SET FALSE;
GRANT CONNECT ON DATABASE postgres TO tiktok_api_runtime;
GRANT USAGE ON SCHEMA public TO tiktok_api_access;
GRANT SELECT ON public.users, public.import_batches, public.products,
  public.legacy_records, public.legacy_values, public.purchase_rounds, public.sales_details,
  public.stage_snapshots, public.product_history, public.refunds, public.product_images,
  public.mutation_requests TO tiktok_api_access;
GRANT SELECT (id,filename,sha256,metadata,received_at) ON public.source_archives TO tiktok_api_access;
-- Product identity/classification/archive/create are not business operations approved by source.
GRANT UPDATE (current_stage_label,current_stage_group,current_stage_index,current_status,
  current_date_text,wholesale,sample_sales_quantity,refund_quantity,note,pic,source_field_states,
  version,updated_at) ON public.products TO tiktok_api_access;
GRANT INSERT ON public.purchase_rounds, public.sales_details, public.mutation_requests,
  public.stage_snapshots, public.product_history TO tiktok_api_access;
GRANT UPDATE (ordered,received,cancelled,verified,issue,order_price,order_price_state,
  ordered_at_text,received_at_text,ordered_at_utc,received_at_utc,raw_state,source_field_states,
  version) ON public.purchase_rounds TO tiktok_api_access;
GRANT UPDATE (unit_price,unit_price_state,sold_quantity,quantity_state,raw_fields)
  ON public.sales_details TO tiktok_api_access;
GRANT UPDATE (outcome) ON public.mutation_requests TO tiktok_api_access;
-- Neither role owns tables or has CREATE, DELETE, TRUNCATE, trigger or source write grants.
-- Context is trusted server authorization input, NOT standalone JWT authentication.
CREATE FUNCTION public.runtime_actor_can_read() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u
    WHERE u.id::text=current_setting('app.actor_id',true)
      AND u.auth_subject=current_setting('app.auth_subject',true)
      AND u.role IN ('ADMIN','EDITOR','VIEWER'));
$$;
CREATE FUNCTION public.runtime_actor_can_write() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u
    WHERE u.id::text=current_setting('app.actor_id',true)
      AND u.auth_subject=current_setting('app.auth_subject',true)
      AND u.role IN ('ADMIN','EDITOR'));
$$;
REVOKE ALL ON FUNCTION public.runtime_actor_can_read(),public.runtime_actor_can_write() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.runtime_actor_can_read(),public.runtime_actor_can_write() TO tiktok_api_access;
CREATE POLICY runtime_identity_lookup ON public.users FOR SELECT TO tiktok_api_access
USING (auth_subject=current_setting('app.auth_subject',true));
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['source_archives','import_batches','products','legacy_records','legacy_values',
    'purchase_rounds','sales_details','stage_snapshots','product_history','refunds','product_images','mutation_requests'] LOOP
    EXECUTE format('CREATE POLICY runtime_read ON public.%I FOR SELECT TO tiktok_api_access USING (public.runtime_actor_can_read())',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['products','purchase_rounds','sales_details'] LOOP
    EXECUTE format('CREATE POLICY runtime_update ON public.%I FOR UPDATE TO tiktok_api_access USING (public.runtime_actor_can_write()) WITH CHECK (public.runtime_actor_can_write())',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['purchase_rounds','sales_details'] LOOP
    EXECUTE format('CREATE POLICY runtime_insert ON public.%I FOR INSERT TO tiktok_api_access WITH CHECK (public.runtime_actor_can_write())',t);
  END LOOP;
END $$;
CREATE POLICY runtime_history_append ON public.product_history FOR INSERT TO tiktok_api_access
WITH CHECK (public.runtime_actor_can_write() AND import_batch_id IS NULL AND legacy_event_index IS NULL
  AND actor_id::text=current_setting('app.actor_id',true));
CREATE POLICY runtime_snapshot_append ON public.stage_snapshots FOR INSERT TO tiktok_api_access
WITH CHECK (public.runtime_actor_can_write() AND import_batch_id IS NULL AND source_json_pointer IS NULL);
CREATE POLICY runtime_request_insert ON public.mutation_requests FOR INSERT TO tiktok_api_access
WITH CHECK (public.runtime_actor_can_write() AND actor_id::text=current_setting('app.actor_id',true));
CREATE POLICY runtime_request_update ON public.mutation_requests FOR UPDATE TO tiktok_api_access
USING (public.runtime_actor_can_write() AND actor_id::text=current_setting('app.actor_id',true))
WITH CHECK (public.runtime_actor_can_write() AND actor_id::text=current_setting('app.actor_id',true));
COMMIT;
-- LOGIN/password provisioning is separate, secret-only, after migration verification.
-- truonglt Phase3.1 owner-approved runtime security migration end
