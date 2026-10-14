-- truonglt owner-reviewed new product origin enum start
-- Enum addition only. Existing XLSX_MATCHED and LEGACY_UNMATCHED rows do not change.
ALTER TYPE "SourceClassification" ADD VALUE IF NOT EXISTS 'MANUAL';
-- truonglt owner-reviewed new product origin enum end
