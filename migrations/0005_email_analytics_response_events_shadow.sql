ALTER TABLE "email_analytics_settings"
  ADD COLUMN IF NOT EXISTS "response_event_measurement_start_at" timestamp NOT NULL DEFAULT (now() - interval '60 days'),
  ADD COLUMN IF NOT EXISTS "response_event_last_built_at" timestamp;

UPDATE "email_analytics_settings"
SET "response_event_measurement_start_at" = now() - interval '60 days'
WHERE "response_event_last_built_at" IS NULL;

CREATE TABLE IF NOT EXISTS "email_analytics_response_events" (
  "id" serial PRIMARY KEY,
  "organisation_id" integer NOT NULL REFERENCES "organisations"("id"),
  "canonical_conversation_id" integer NOT NULL REFERENCES "email_analytics_conversations"("id"),
  "client_contact_id" integer REFERENCES "email_analytics_contacts"("id"),
  "triggering_client_message_id" integer NOT NULL REFERENCES "email_analytics_messages"("id"),
  "latest_client_message_id" integer NOT NULL REFERENCES "email_analytics_messages"("id"),
  "client_message_count" integer NOT NULL DEFAULT 1,
  "received_at" timestamp NOT NULL,
  "latest_client_message_at" timestamp NOT NULL,
  "deadline_at" timestamp NOT NULL,
  "response_message_id" integer REFERENCES "email_analytics_messages"("id"),
  "response_at" timestamp,
  "outcome" varchar NOT NULL DEFAULT 'pending',
  "handling_source" varchar NOT NULL DEFAULT 'automatic',
  "manual_classification" varchar,
  "handled_at" timestamp,
  "handled_by_user_id" integer REFERENCES "users"("id"),
  "sla_version" integer NOT NULL DEFAULT 1,
  "backfill_confidence" varchar NOT NULL DEFAULT 'observed_after_measurement_start',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "email_analytics_response_event_trigger_key"
    UNIQUE ("organisation_id", "triggering_client_message_id")
);

ALTER TABLE "email_analytics_response_events"
  ADD COLUMN IF NOT EXISTS "manual_classification" varchar;

CREATE INDEX IF NOT EXISTS "email_analytics_response_event_received_index"
  ON "email_analytics_response_events" ("organisation_id", "received_at");
CREATE INDEX IF NOT EXISTS "email_analytics_response_event_outcome_index"
  ON "email_analytics_response_events" ("organisation_id", "outcome");
CREATE INDEX IF NOT EXISTS "email_analytics_response_event_conversation_index"
  ON "email_analytics_response_events" ("canonical_conversation_id", "received_at");

CREATE TABLE IF NOT EXISTS "email_analytics_response_event_audit" (
  "id" serial PRIMARY KEY,
  "organisation_id" integer NOT NULL REFERENCES "organisations"("id"),
  "response_event_id" integer NOT NULL REFERENCES "email_analytics_response_events"("id"),
  "previous_outcome" varchar,
  "outcome" varchar NOT NULL,
  "handled_at" timestamp,
  "performed_by_user_id" integer NOT NULL REFERENCES "users"("id"),
  "performed_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_analytics_response_event_exceptions" (
  "id" serial PRIMARY KEY,
  "organisation_id" integer NOT NULL REFERENCES "organisations"("id"),
  "response_event_id" integer NOT NULL REFERENCES "email_analytics_response_events"("id"),
  "subsequent_response_message_id" integer NOT NULL REFERENCES "email_analytics_messages"("id"),
  "subsequent_response_at" timestamp NOT NULL,
  "response_within_deadline" boolean NOT NULL,
  "status" varchar NOT NULL DEFAULT 'open',
  "resolved_by_user_id" integer REFERENCES "users"("id"),
  "resolved_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "email_analytics_response_event_exception_event_key" UNIQUE ("response_event_id")
);
CREATE INDEX IF NOT EXISTS "email_analytics_response_event_exception_status_index"
  ON "email_analytics_response_event_exceptions" ("organisation_id", "status");

CREATE TABLE IF NOT EXISTS "email_analytics_response_event_exception_audit" (
  "id" serial PRIMARY KEY,
  "organisation_id" integer NOT NULL REFERENCES "organisations"("id"),
  "exception_id" integer NOT NULL REFERENCES "email_analytics_response_event_exceptions"("id"),
  "action" varchar NOT NULL,
  "previous_outcome" varchar NOT NULL,
  "outcome" varchar NOT NULL,
  "performed_by_user_id" integer NOT NULL REFERENCES "users"("id"),
  "performed_at" timestamp NOT NULL DEFAULT now()
);