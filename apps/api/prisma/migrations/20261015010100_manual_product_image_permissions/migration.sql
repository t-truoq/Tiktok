-- truonglt owner-reviewed product create and private image append permissions start
BEGIN;
GRANT INSERT ON public.products, public.product_images TO tiktok_api_access;
CREATE POLICY runtime_manual_product_create ON public.products FOR INSERT TO tiktok_api_access
WITH CHECK (public.runtime_actor_can_write()
  AND classification='MANUAL'::"SourceClassification" AND legacy_key LIKE 'MANUAL_%'
  AND archived=false AND version=1
  AND current_stage_label IS NULL AND current_stage_group IS NULL AND current_stage_index IS NULL
  AND wholesale IS NULL AND sample_sales_quantity IS NULL AND refund_quantity IS NULL
  AND source_field_states->>'origin'='MANUAL'
  AND source_field_states->>'createdBy'=current_setting('app.actor_id',true));
CREATE POLICY runtime_product_image_append ON public.product_images FOR INSERT TO tiktok_api_access
WITH CHECK (public.runtime_actor_can_write()
  AND storage_path IS NULL AND content_type IN ('image/jpeg','image/png','image/webp')
  AND upload_metadata->>'driver'='PRIVATE_INLINE_V1'
  AND upload_metadata->>'actorId'=current_setting('app.actor_id',true)
  AND EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_id
    AND p.classification IN ('XLSX_MATCHED','MANUAL') AND p.archived=false));
-- No UPDATE/DELETE image grant: imported image metadata and older uploads remain intact.
-- No source archives, legacy records, history, managed auth/storage schema or financial change.
COMMIT;
-- truonglt owner-reviewed product create and private image append permissions end
