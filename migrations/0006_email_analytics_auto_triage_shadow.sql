ALTER TABLE "email_analytics_settings"
  ADD COLUMN IF NOT EXISTS "auto_triage_mode" varchar NOT NULL DEFAULT 'disabled',
  ADD COLUMN IF NOT EXISTS "auto_triage_confidence_threshold" numeric(4,3) NOT NULL DEFAULT 0.980,
  ADD COLUMN IF NOT EXISTS "auto_triage_validation_reviewed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "auto_triage_validation_reviewed_by_user_id" integer REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "auto_triage_activation_approved_at" timestamp,
  ADD COLUMN IF NOT EXISTS "auto_triage_activation_approved_by_user_id" integer REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "auto_triage_last_run_at" timestamp,
  ADD COLUMN IF NOT EXISTS "auto_triage_last_error_code" varchar;

CREATE TABLE IF NOT EXISTS "email_analytics_triage_predictions" (
  "id" serial PRIMARY KEY,
  "organisation_id" integer NOT NULL REFERENCES "organisations"("id"),
  "canonical_conversation_id" integer NOT NULL REFERENCES "email_analytics_conversations"("id"),
  "client_message_id" integer NOT NULL REFERENCES "email_analytics_messages"("id"),
  "label" varchar NOT NULL,
  "confidence" numeric(4,3) NOT NULL,
  "reason_code" varchar NOT NULL,
  "classifier_source" varchar NOT NULL,
  "classifier_version" varchar NOT NULL,
  "model_id" varchar,
  "status" varchar NOT NULL DEFAULT 'shadow',
  "classified_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "email_analytics_triage_prediction_message_key"
    UNIQUE ("organisation_id", "client_message_id")
);

CREATE INDEX IF NOT EXISTS "email_analytics_triage_prediction_status_index"
  ON "email_analytics_triage_predictions" ("organisation_id", "status");
CREATE INDEX IF NOT EXISTS "email_analytics_triage_prediction_conversation_index"
  ON "email_analytics_triage_predictions" ("canonical_conversation_id", "classified_at");

ALTER TABLE "email_analytics_disposition_audit"
  ALTER COLUMN "performed_by_user_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "actor_kind" varchar NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "triage_prediction_id" integer REFERENCES "email_analytics_triage_predictions"("id");

ALTER TABLE "email_analytics_response_event_audit"
  ALTER COLUMN "performed_by_user_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "actor_kind" varchar NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "triage_prediction_id" integer REFERENCES "email_analytics_triage_predictions"("id");