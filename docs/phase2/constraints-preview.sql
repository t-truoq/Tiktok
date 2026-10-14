-- truonglt phase2 constraint proposal start
-- OFFLINE PREVIEW ONLY. No SQL in this file has been executed against Supabase.
ALTER TABLE "purchase_rounds" ADD CONSTRAINT "round_index_positive" CHECK ("round_index" > 0 AND "round_index" <= 9007199254740991);
ALTER TABLE "products" ADD CONSTRAINT "stage_index_positive" CHECK ("current_stage_index" IS NULL OR ("current_stage_index" > 0 AND "current_stage_index" <= 9007199254740991));
ALTER TABLE "products" ADD CONSTRAINT "product_version_positive" CHECK ("version" > 0);
ALTER TABLE "purchase_rounds" ADD CONSTRAINT "round_version_positive" CHECK ("version" > 0);
ALTER TABLE "product_history" ADD CONSTRAINT "legacy_event_index_nonnegative" CHECK ("legacy_event_index" IS NULL OR "legacy_event_index" >= 0);
ALTER TABLE "source_archives" ADD CONSTRAINT "source_checksum_format" CHECK ("sha256" ~ '^[a-f0-9]{64}$');
ALTER TABLE "legacy_records" ADD CONSTRAINT "decoded_checksum_format" CHECK ("decoded_sha256" ~ '^[a-f0-9]{64}$');
ALTER TABLE "import_batches" ADD CONSTRAINT "batch_counts_nonnegative" CHECK ("imported_count" >= 0 AND "failed_count" >= 0);
ALTER TABLE "import_batches" ADD CONSTRAINT "batch_plan_checksum_format" CHECK ("plan_sha256" ~ '^[a-f0-9]{64}$');
ALTER TABLE "import_batches" ADD CONSTRAINT "batch_status_valid" CHECK ("status" IN ('PREPARED', 'COMMITTED', 'FAILED', 'ROLLED_BACK'));
ALTER TABLE "mutation_requests" ADD CONSTRAINT "request_checksum_format" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "legacy_records" ADD CONSTRAINT "record_batch_source_fk" FOREIGN KEY ("import_batch_id", "source_archive_id") REFERENCES "import_batches" ("id", "source_archive_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "legacy_records" ADD CONSTRAINT "record_product_key_fk" FOREIGN KEY ("product_id", "legacy_key") REFERENCES "products" ("id", "legacy_key") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "product_history" ADD CONSTRAINT "imported_history_identity" CHECK (("import_batch_id" IS NULL AND "legacy_event_index" IS NULL) OR ("import_batch_id" IS NOT NULL AND "legacy_event_index" IS NOT NULL AND "original_payload" IS NOT NULL AND "actor_id" IS NULL));
ALTER TABLE "stage_snapshots" ADD CONSTRAINT "imported_snapshot_identity" CHECK ("import_batch_id" IS NULL OR "source_json_pointer" IS NOT NULL);
ALTER TABLE "product_history" ADD CONSTRAINT "history_imported_product_fk" FOREIGN KEY ("product_id", "import_batch_id") REFERENCES "legacy_records" ("product_id", "import_batch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "stage_snapshots" ADD CONSTRAINT "snapshot_imported_product_fk" FOREIGN KEY ("product_id", "import_batch_id") REFERENCES "legacy_records" ("product_id", "import_batch_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "refunds" ADD CONSTRAINT "refund_groups_valid" CHECK ("sample_group" = 'SAMPLE' AND "end_group" = 'END');
ALTER TABLE "refunds" ADD CONSTRAINT "refund_sample_product_fk" FOREIGN KEY ("sample_round_id", "product_id", "sample_group") REFERENCES "purchase_rounds" ("id", "product_id", "group") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "refunds" ADD CONSTRAINT "refund_end_product_fk" FOREIGN KEY ("end_round_id", "product_id", "end_group") REFERENCES "purchase_rounds" ("id", "product_id", "group") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "purchase_rounds" ADD CONSTRAINT "order_price_state_consistent" CHECK (("order_price_state" = 'NUMBER') = ("order_price" IS NOT NULL));
ALTER TABLE "sales_details" ADD CONSTRAINT "sales_value_states_consistent" CHECK ((("unit_price_state" = 'NUMBER') = ("unit_price" IS NOT NULL)) AND (("quantity_state" = 'NUMBER') = ("sold_quantity" IS NOT NULL)));

CREATE FUNCTION "reject_immutable_source_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable source/history: UPDATE and DELETE are prohibited' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "source_archive_immutable" BEFORE UPDATE OR DELETE ON "source_archives"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "legacy_record_immutable" BEFORE UPDATE OR DELETE ON "legacy_records"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "legacy_value_immutable" BEFORE UPDATE OR DELETE ON "legacy_values"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "history_append_only" BEFORE UPDATE OR DELETE ON "product_history"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "snapshot_append_only" BEFORE UPDATE OR DELETE ON "stage_snapshots"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "source_archive_no_truncate" BEFORE TRUNCATE ON "source_archives" FOR EACH STATEMENT EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "legacy_record_no_truncate" BEFORE TRUNCATE ON "legacy_records" FOR EACH STATEMENT EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "legacy_value_no_truncate" BEFORE TRUNCATE ON "legacy_values" FOR EACH STATEMENT EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "history_no_truncate" BEFORE TRUNCATE ON "product_history" FOR EACH STATEMENT EXECUTE FUNCTION "reject_immutable_source_change"();
CREATE TRIGGER "snapshot_no_truncate" BEFORE TRUNCATE ON "stage_snapshots" FOR EACH STATEMENT EXECUTE FUNCTION "reject_immutable_source_change"();
REVOKE ALL ON FUNCTION "reject_immutable_source_change"() FROM PUBLIC, anon, authenticated, service_role;

-- Backend-only data access. No client policies are added; direct client reads/writes are denied.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_archives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legacy_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legacy_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_rounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mutation_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "users", "source_archives", "import_batches", "products", "legacy_records", "legacy_values",
  "purchase_rounds", "sales_details", "stage_snapshots", "product_history", "refunds", "product_images", "mutation_requests"
FROM PUBLIC, anon, authenticated, service_role;
-- Table owners / superusers / BYPASSRLS roles can bypass RLS. Runtime must not use
-- postgres or service_role after deployment. Dedicated role grants require review.
-- A failed uncommitted import rolls back its transaction. A committed import is
-- never undone by DELETE: restore an approved pre-import backup into an isolated
-- database, reconcile it, then approve the switch. Immutable source is retained.
-- truonglt phase2 constraint proposal end
