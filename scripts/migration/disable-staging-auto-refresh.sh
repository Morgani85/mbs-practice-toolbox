#!/usr/bin/env bash
# STAGING ONLY: turn off Email Analytics automatic refresh after a restore, before the
# staging web service is started, so staging never syncs real mailboxes on a schedule.
# Usage: scripts/migration/disable-staging-auto-refresh.sh
source "$(dirname "$0")/_common.sh"
read_url TARGET_DATABASE_URL "Railway STAGING Postgres PUBLIC connection string"
HOST="$(url_host "$TARGET_DATABASE_URL")"
if is_replit_host "$HOST"; then echo "REFUSING: $HOST looks like Replit/Neon." >&2; exit 1; fi
echo "Target host: $HOST"
echo "Currently enabled: $(psql_ro "$TARGET_DATABASE_URL" -Atc "SELECT count(*) FROM email_analytics_settings WHERE automatic_refresh_enabled")"
confirm_word staging

psql_rw "$TARGET_DATABASE_URL" -q -At -c "UPDATE email_analytics_settings SET automatic_refresh_enabled = false WHERE automatic_refresh_enabled RETURNING organisation_id" \
  | sed 's/^/disabled for organisation_id /'
LEFT="$(psql_ro "$TARGET_DATABASE_URL" -Atc "SELECT count(*) FROM email_analytics_settings WHERE automatic_refresh_enabled")"
[ "$LEFT" = "0" ] || { echo "FAIL: $LEFT organisations still have automatic refresh on." >&2; exit 1; }
echo "OK: automatic refresh is off for every organisation in staging. The staging web service may now be started."
