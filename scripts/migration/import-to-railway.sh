#!/usr/bin/env bash
# Restore a production dump into an EMPTY Railway database (staging or production).
# The Railway web service must be stopped first (no other client connections allowed).
# Usage: scripts/migration/import-to-railway.sh staging|production /path/to/file.dump
source "$(dirname "$0")/_common.sh"
TARGET_ENV="${1:?Usage: import-to-railway.sh staging|production DUMP}"
DUMP="${2:?Usage: import-to-railway.sh staging|production DUMP}"
case "$TARGET_ENV" in staging|production) ;; *) echo "Target must be staging or production." >&2; exit 1 ;; esac

# 1. Dump integrity.
[ -f "$DUMP" ] && [ -f "$DUMP.sha256" ] || { echo "Dump or its .sha256 file is missing." >&2; exit 1; }
(cd "$(dirname "$DUMP")" && shasum -a 256 -c "$(basename "$DUMP").sha256") || { echo "Checksum mismatch." >&2; exit 1; }

read_url TARGET_DATABASE_URL "Railway $TARGET_ENV Postgres PUBLIC connection string (DATABASE_PUBLIC_URL)"
HOST="$(url_host "$TARGET_DATABASE_URL")"

# 2. Never write to Replit / Neon.
if is_replit_host "$HOST"; then echo "REFUSING: $HOST looks like Replit/Neon." >&2; exit 1; fi

# 3. Target must be empty (only the app-created 'sessions' table is tolerated) and idle.
PUBLIC_TABLES="$(psql_ro "$TARGET_DATABASE_URL" -Atc "SELECT coalesce(string_agg(tablename, ',' ORDER BY tablename), '') FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'sessions'")"
OTHER_CONN="$(psql_ro "$TARGET_DATABASE_URL" -Atc "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND backend_type = 'client backend'")"
HAS_REPLIT="$(psql_ro "$TARGET_DATABASE_URL" -Atc "SELECT to_regclass('_system.replit_database_migrations_v1') IS NOT NULL")"
SERVER_MAJOR="$(psql_ro "$TARGET_DATABASE_URL" -Atc "SELECT current_setting('server_version_num')::int / 10000")"

echo "Target environment: $TARGET_ENV"
echo "Target host:        $HOST"
echo "Target major:       $SERVER_MAJOR"
echo "Existing tables:    ${PUBLIC_TABLES:-none (besides sessions)}"
echo "Other connections:  $OTHER_CONN"
[ "$HAS_REPLIT" = "f" ] || { echo "REFUSING: target has the Replit _system schema." >&2; exit 1; }
[ "$SERVER_MAJOR" = "16" ] || { echo "REFUSING: target is not PostgreSQL 16." >&2; exit 1; }
[ -z "$PUBLIC_TABLES" ] || { echo "REFUSING: target is not empty." >&2; exit 1; }
[ "$OTHER_CONN" = "0" ] || { echo "REFUSING: other clients are connected. Stop the Railway web service first." >&2; exit 1; }

confirm_word "$TARGET_ENV"

# 4. Restore in one transaction; any error rolls back everything.
echo "Restoring ..."
"$PG_RESTORE" --dbname="$TARGET_DATABASE_URL" \
  --no-owner --no-privileges --clean --if-exists \
  --single-transaction --exit-on-error "$DUMP"

# 5. Match production's database time zone (GMT). Data is unaffected.
psql_rw "$TARGET_DATABASE_URL" -qc "DO \$\$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'GMT'); END \$\$;"
echo "Database time zone now: $(psql_ro "$TARGET_DATABASE_URL" -Atc "SHOW timezone")"

echo "Restore complete. Do NOT start the web service yet."
echo "Next: scripts/migration/verify-database.sh $TARGET_ENV"
[ "$TARGET_ENV" = "staging" ] && echo "Then: scripts/migration/disable-staging-auto-refresh.sh"
exit 0
