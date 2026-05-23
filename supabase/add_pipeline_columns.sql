-- Migration: add agent-pipeline result columns to HealthFlow_transcript
-- Run once in the Supabase SQL editor.
-- All columns use ADD COLUMN IF NOT EXISTS so this is safe to re-run.

-- Pipeline output columns (stored as JSON text for flexibility)
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "structuredData"       text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "diagnosis"             text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "draftOrders"           text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "safetyFlags"           text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "safetyRecommendation"  text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "auditTrail"            text;

-- Encounter lifecycle
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "status"   text DEFAULT 'field_capture';
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "acuity"   text DEFAULT 'medium';

-- Doctor approval
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "approvedBy"      text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "approvedAt"       text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "physicianName"    text;

-- Nursing
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "nursingNotes"  text;
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "triageStatus"  text DEFAULT 'pending';

-- Cross-reference back to the encounters pipeline table
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "encounterId" text;

-- Timestamps (used by nurse queue display)
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "createdAt"  timestamptz DEFAULT now();
ALTER TABLE "HealthFlow_transcript" ADD COLUMN IF NOT EXISTS "updatedAt"  timestamptz DEFAULT now();

-- Row-Level Security: ensure anon can select + update
-- (skip if already set; adjust to match your project's RLS policy)
ALTER TABLE "HealthFlow_transcript" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'HealthFlow_transcript' AND policyname = 'Allow anon read'
  ) THEN
    CREATE POLICY "Allow anon read"
      ON "HealthFlow_transcript" FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'HealthFlow_transcript' AND policyname = 'Allow anon update'
  ) THEN
    CREATE POLICY "Allow anon update"
      ON "HealthFlow_transcript" FOR UPDATE USING (true);
  END IF;
END
$$;
