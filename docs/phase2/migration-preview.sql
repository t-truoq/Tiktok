-- truonglt phase2 offline migration preview start
-- REVIEW ARTIFACT ONLY: not in active Prisma migrations; not applied to any database.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "SourceClassification" AS ENUM ('XLSX_MATCHED', 'LEGACY_UNMATCHED');

-- CreateEnum
CREATE TYPE "RoundGroup" AS ENUM ('SAMPLE', 'END');

-- CreateEnum
CREATE TYPE "ValueState" AS ENUM ('MISSING', 'NULL', 'BLANK', 'NUMBER', 'TEXT', 'BOOLEAN', 'ARRAY', 'OBJECT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_subject" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_archives" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "original_bytes" BYTEA NOT NULL,
    "metadata" JSONB NOT NULL,
    "other_properties" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "source_archive_id" UUID NOT NULL,
    "mapping_version" TEXT NOT NULL,
    "plan_sha256" CHAR(64) NOT NULL,
    "status" TEXT NOT NULL,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "reconciliation" JSONB,
    "rollback_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "legacy_key" TEXT NOT NULL,
    "root_name" TEXT NOT NULL,
    "root_name_normalized" TEXT NOT NULL,
    "classification" "SourceClassification" NOT NULL,
    "current_stage_label" TEXT,
    "current_stage_group" "RoundGroup",
    "current_stage_index" BIGINT,
    "current_status" TEXT,
    "current_date_text" TEXT,
    "wholesale" DECIMAL(18,2),
    "sample_sales_quantity" DECIMAL(18,3),
    "refund_quantity" DECIMAL(18,3),
    "note" TEXT,
    "pic" TEXT,
    "source_field_states" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_records" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "source_archive_id" UUID NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "legacy_key" TEXT NOT NULL,
    "manifest" TEXT NOT NULL,
    "chunks" JSONB NOT NULL,
    "raw_json_text" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "decoded_sha256" CHAR(64) NOT NULL,
    "field_types" JSONB NOT NULL,
    "schema_version_text" TEXT,
    "calculation_projection" JSONB,
    "source_timezone" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_values" (
    "id" UUID NOT NULL,
    "legacy_record_id" UUID NOT NULL,
    "json_pointer" TEXT NOT NULL,
    "state" "ValueState" NOT NULL,
    "raw_value" JSONB,
    "decimal_value" DECIMAL(18,3),

    CONSTRAINT "legacy_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_rounds" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "group" "RoundGroup" NOT NULL,
    "round_index" BIGINT NOT NULL,
    "ordered" BOOLEAN,
    "received" BOOLEAN,
    "cancelled" BOOLEAN,
    "verified" BOOLEAN,
    "issue" TEXT,
    "order_price" DECIMAL(18,2),
    "order_price_state" "ValueState" NOT NULL,
    "ordered_at_text" TEXT,
    "received_at_text" TEXT,
    "ordered_at_utc" TIMESTAMPTZ(6),
    "received_at_utc" TIMESTAMPTZ(6),
    "raw_state" JSONB,
    "source_field_states" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "purchase_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_details" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "unit_price" DECIMAL(18,2),
    "unit_price_state" "ValueState" NOT NULL,
    "sold_quantity" DECIMAL(18,3),
    "quantity_state" "ValueState" NOT NULL,
    "raw_fields" JSONB NOT NULL,

    CONSTRAINT "sales_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_snapshots" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "source_label" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "source_date_text" TEXT,
    "effective_at_utc" TIMESTAMPTZ(6),
    "source_json_pointer" TEXT,
    "import_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_history" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "import_batch_id" UUID,
    "legacy_event_index" INTEGER,
    "event_type" TEXT NOT NULL,
    "stage_label" TEXT,
    "source_timestamp_text" TEXT,
    "occurred_at_utc" TIMESTAMPTZ(6),
    "original_payload" JSONB,
    "before_json" JSONB,
    "after_json" JSONB,
    "actor_id" UUID,
    "request_id" TEXT,
    "reason" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sample_round_id" UUID,
    "sample_group" "RoundGroup" NOT NULL DEFAULT 'SAMPLE',
    "end_round_id" UUID,
    "end_group" "RoundGroup" NOT NULL DEFAULT 'END',
    "eligibility" JSONB NOT NULL,
    "review_fields" JSONB,
    "actual_refund_data" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "storage_path" TEXT,
    "content_type" TEXT,
    "legacy_reference" JSONB,
    "upload_metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutation_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "outcome" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");

-- CreateIndex
CREATE UNIQUE INDEX "source_archives_sha256_key" ON "source_archives"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_source_archive_id_mapping_version_key" ON "import_batches"("source_archive_id", "mapping_version");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_id_source_archive_id_key" ON "import_batches"("id", "source_archive_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_legacy_key_key" ON "products"("legacy_key");

-- CreateIndex
CREATE UNIQUE INDEX "products_root_name_normalized_key" ON "products"("root_name_normalized");

-- CreateIndex
CREATE INDEX "products_current_status_current_stage_group_current_stage_i_idx" ON "products"("current_status", "current_stage_group", "current_stage_index");

-- CreateIndex
CREATE INDEX "products_classification_archived_idx" ON "products"("classification", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "products_id_legacy_key_key" ON "products"("id", "legacy_key");

-- CreateIndex
CREATE INDEX "legacy_records_product_id_idx" ON "legacy_records"("product_id");

-- CreateIndex
CREATE INDEX "legacy_records_import_batch_id_idx" ON "legacy_records"("import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_records_source_archive_id_legacy_key_key" ON "legacy_records"("source_archive_id", "legacy_key");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_records_product_id_import_batch_id_key" ON "legacy_records"("product_id", "import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_values_legacy_record_id_json_pointer_key" ON "legacy_values"("legacy_record_id", "json_pointer");

-- CreateIndex
CREATE INDEX "purchase_rounds_product_id_ordered_received_cancelled_idx" ON "purchase_rounds"("product_id", "ordered", "received", "cancelled");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_rounds_product_id_group_round_index_key" ON "purchase_rounds"("product_id", "group", "round_index");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_rounds_id_product_id_group_key" ON "purchase_rounds"("id", "product_id", "group");

-- CreateIndex
CREATE UNIQUE INDEX "sales_details_round_id_key" ON "sales_details"("round_id");

-- CreateIndex
CREATE INDEX "stage_snapshots_product_id_source_label_idx" ON "stage_snapshots"("product_id", "source_label");

-- CreateIndex
CREATE INDEX "stage_snapshots_import_batch_id_idx" ON "stage_snapshots"("import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_snapshots_product_id_import_batch_id_source_json_poin_key" ON "stage_snapshots"("product_id", "import_batch_id", "source_json_pointer");

-- CreateIndex
CREATE INDEX "product_history_product_id_legacy_event_index_idx" ON "product_history"("product_id", "legacy_event_index");

-- CreateIndex
CREATE INDEX "product_history_product_id_recorded_at_idx" ON "product_history"("product_id", "recorded_at");

-- CreateIndex
CREATE INDEX "product_history_import_batch_id_idx" ON "product_history"("import_batch_id");

-- CreateIndex
CREATE INDEX "product_history_actor_id_idx" ON "product_history"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_history_product_id_import_batch_id_legacy_event_ind_key" ON "product_history"("product_id", "import_batch_id", "legacy_event_index");

-- CreateIndex
CREATE INDEX "refunds_product_id_idx" ON "refunds"("product_id");

-- CreateIndex
CREATE INDEX "refunds_sample_round_id_idx" ON "refunds"("sample_round_id");

-- CreateIndex
CREATE INDEX "refunds_end_round_id_idx" ON "refunds"("end_round_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "mutation_requests_actor_id_idempotency_key_key" ON "mutation_requests"("actor_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_source_archive_id_fkey" FOREIGN KEY ("source_archive_id") REFERENCES "source_archives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_records" ADD CONSTRAINT "legacy_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_records" ADD CONSTRAINT "legacy_records_source_archive_id_fkey" FOREIGN KEY ("source_archive_id") REFERENCES "source_archives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_records" ADD CONSTRAINT "legacy_records_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_values" ADD CONSTRAINT "legacy_values_legacy_record_id_fkey" FOREIGN KEY ("legacy_record_id") REFERENCES "legacy_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_rounds" ADD CONSTRAINT "purchase_rounds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_details" ADD CONSTRAINT "sales_details_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "purchase_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_snapshots" ADD CONSTRAINT "stage_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_snapshots" ADD CONSTRAINT "stage_snapshots_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_history" ADD CONSTRAINT "product_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_history" ADD CONSTRAINT "product_history_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_history" ADD CONSTRAINT "product_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_sample_round_id_fkey" FOREIGN KEY ("sample_round_id") REFERENCES "purchase_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_end_round_id_fkey" FOREIGN KEY ("end_round_id") REFERENCES "purchase_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutation_requests" ADD CONSTRAINT "mutation_requests_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


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

-- truonglt phase2 offline migration preview end
