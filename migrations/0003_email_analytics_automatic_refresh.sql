ALTER TABLE "email_analytics_settings"
ADD COLUMN IF NOT EXISTS "automatic_refresh_enabled" boolean NOT NULL DEFAULT true;

ALTER TABLE "email_analytics_settings"
ALTER COLUMN "sync_interval_minutes" SET DEFAULT 30;

UPDATE "email_analytics_settings"
SET "sync_interval_minutes" = 30
WHERE "sync_interval_minutes" < 30;