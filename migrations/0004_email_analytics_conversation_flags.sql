ALTER TABLE "email_analytics_conversations"
  ADD COLUMN IF NOT EXISTS "is_flagged" boolean NOT NULL DEFAULT false;