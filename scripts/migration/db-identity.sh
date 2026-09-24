#!/usr/bin/env bash
# Read-only identity check for any database (source or target).
# Usage: scripts/migration/db-identity.sh            (prompts for the connection string)
#        DB_URL=... scripts/migration/db-identity.sh
source "$(dirname "$0")/_common.sh"
read_url DB_URL "Connection string to identify"

echo "Host: $(url_host "$DB_URL")"
psql_ro "$DB_URL" -At -F ' | ' <<'SQL'
SELECT 'server_version', version();
SELECT 'timezone', current_setting('TimeZone');
SELECT 'read_only_session', current_setting('default_transaction_read_only');
SELECT 'replit_publish_table', (to_regclass('_system.replit_database_migrations_v1') IS NOT NULL)::text;
SELECT 'public_tables', count(*)::text FROM pg_tables WHERE schemaname = 'public';
SELECT 'has_users_table', (to_regclass('public.users') IS NOT NULL)::text;
SELECT 'has_financial_clarity_reviews', (to_regclass('public.financial_clarity_reviews') IS NOT NULL)::text;
SELECT 'other_client_connections', count(*)::text FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid() AND backend_type = 'client backend';
SQL
# Row-level markers only when the app tables exist.
if [ "$(psql_ro "$DB_URL" -Atc "SELECT to_regclass('public.users') IS NOT NULL")" = "t" ]; then
  psql_ro "$DB_URL" -At -F ' | ' <<'SQL'
SELECT 'users', count(*)::text FROM users;
SELECT 'latest_sync_run', coalesce(max(started_at)::text, 'none') FROM email_analytics_sync_runs;
SELECT 'auto_refresh_enabled_orgs', count(*)::text FROM email_analytics_settings WHERE automatic_refresh_enabled;
SQL
fi
