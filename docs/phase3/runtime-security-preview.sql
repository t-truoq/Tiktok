-- truonglt Phase3 runtime security proposal start
-- REVIEW ONLY: NOT EXECUTED. Separate owner approval required.
-- No password, LOGIN activation, ownership change or managed schema modification.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tiktok_api_runtime') THEN
    RAISE EXCEPTION 'Runtime role already exists: review before applying';
  END IF;
END $$;
CREATE ROLE tiktok_api_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO tiktok_api_runtime;
GRANT SELECT ON public.users, public.source_archives, public.import_batches,
  public.products, public.legacy_records, public.legacy_values, public.purchase_rounds,
  public.sales_details, public.stage_snapshots, public.product_history, public.refunds,
  public.product_images, public.mutation_requests TO tiktok_api_runtime;
GRANT INSERT, UPDATE ON public.products, public.purchase_rounds, public.sales_details,
  public.mutation_requests TO tiktok_api_runtime;
GRANT INSERT ON public.stage_snapshots, public.product_history TO tiktok_api_runtime;
-- No DELETE, TRUNCATE, DDL, immutable UPDATE or archive/import/legacy INSERT grants.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','source_archives','import_batches','products','legacy_records',
    'legacy_values','purchase_rounds','sales_details','stage_snapshots','product_history',
    'refunds','product_images','mutation_requests'] LOOP
    EXECUTE format('CREATE POLICY runtime_read ON public.%I FOR SELECT TO tiktok_api_runtime USING (true)',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['products','purchase_rounds','sales_details'] LOOP
    EXECUTE format($policy$CREATE POLICY runtime_insert ON public.%I FOR INSERT TO tiktok_api_runtime
      WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id::text=current_setting('app.actor_id',true)
        AND u.role IN ('ADMIN','EDITOR')))$policy$,t);
    EXECUTE format($policy$CREATE POLICY runtime_update ON public.%I FOR UPDATE TO tiktok_api_runtime
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id::text=current_setting('app.actor_id',true)
        AND u.role IN ('ADMIN','EDITOR')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id::text=current_setting('app.actor_id',true)
        AND u.role IN ('ADMIN','EDITOR')))$policy$,t);
  END LOOP;
END $$;
CREATE POLICY runtime_history_append ON public.product_history FOR INSERT TO tiktok_api_runtime
WITH CHECK (import_batch_id IS NULL AND legacy_event_index IS NULL
  AND actor_id::text=current_setting('app.actor_id',true)
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=actor_id AND u.role IN ('ADMIN','EDITOR')));
CREATE POLICY runtime_snapshot_append ON public.stage_snapshots FOR INSERT TO tiktok_api_runtime
WITH CHECK (import_batch_id IS NULL AND EXISTS (SELECT 1 FROM public.users u
  WHERE u.id::text=current_setting('app.actor_id',true) AND u.role IN ('ADMIN','EDITOR')));
CREATE POLICY runtime_request_insert ON public.mutation_requests FOR INSERT TO tiktok_api_runtime
WITH CHECK (actor_id::text=current_setting('app.actor_id',true) AND EXISTS
  (SELECT 1 FROM public.users u WHERE u.id=actor_id AND u.role IN ('ADMIN','EDITOR')));
CREATE POLICY runtime_request_update ON public.mutation_requests FOR UPDATE TO tiktok_api_runtime
USING (actor_id::text=current_setting('app.actor_id',true))
WITH CHECK (actor_id::text=current_setting('app.actor_id',true) AND EXISTS
  (SELECT 1 FROM public.users u WHERE u.id=actor_id AND u.role IN ('ADMIN','EDITOR')));
COMMIT;
-- Follow-up approved provisioning must enable LOGIN with a securely supplied password,
-- verify Supabase Session Pooler login and provision an owner-authorized users row.
-- Test policies with SET LOCAL ROLE in synthetic rollback transactions before enablement.
-- truonglt Phase3 runtime security proposal end
