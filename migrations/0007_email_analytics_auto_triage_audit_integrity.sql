DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_analytics_response_event_audit_actor_integrity'
  ) THEN
    ALTER TABLE "email_analytics_response_event_audit"
      ADD CONSTRAINT "email_analytics_response_event_audit_actor_integrity"
      CHECK (
        ("actor_kind" = 'user' AND "performed_by_user_id" IS NOT NULL AND "triage_prediction_id" IS NULL)
        OR ("actor_kind" = 'automatic_triage' AND "performed_by_user_id" IS NULL AND "triage_prediction_id" IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_analytics_disposition_audit_actor_integrity'
  ) THEN
    ALTER TABLE "email_analytics_disposition_audit"
      ADD CONSTRAINT "email_analytics_disposition_audit_actor_integrity"
      CHECK (
        ("actor_kind" = 'user' AND "performed_by_user_id" IS NOT NULL AND "triage_prediction_id" IS NULL)
        OR ("actor_kind" = 'automatic_triage' AND "performed_by_user_id" IS NULL AND "triage_prediction_id" IS NOT NULL)
      );
  END IF;
END $$;