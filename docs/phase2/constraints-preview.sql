-- truonglt phase2 constraint proposal start
-- OFFLINE PREVIEW ONLY. No SQL in this file has been executed against Supabase.
ALTER TABLE "purchase_rounds" ADD CONSTRAINT "round_index_positive" CHECK ("round_index" > 0 AND "round_index" <= 9007199254740991);
ALTER TABLE "products" ADD CONSTRAINT "stage_index_positive" CHECK ("current_stage_index" IS NULL OR ("current_stage_index" > 0 AND "current_stage_index" <= 9007199254740991));
ALTER TABLE "products" ADD CONSTRAINT "product_version_positive" CHECK ("version" > 0);
ALTER TABLE "purchase_rounds" ADD CONSTRAINT "round_version_positive" CHECK ("version" > 0);
ALTER TABLE "product_history" ADD CONSTRAINT "legacy_event_index_nonnegative" CHECK ("legacy_event_index" IS NULL OR "legacy_event_index" >= 0);
ALTER TABLE "source_archives" ADD CONSTRAINT "source_checksum_format" CHECK ("sha256" ~ '^[a-f0-9]{64}$');
ALTER TABLE "legacy_records" ADD CONSTRAINT "decoded_checksum_format" CHECK ("decoded_sha256" ~ '^[a-f0-9]{64}$');

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
FROM anon, authenticated;
-- truonglt phase2 constraint proposal end
