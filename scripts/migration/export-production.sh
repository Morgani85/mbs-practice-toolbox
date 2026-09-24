#!/usr/bin/env bash
# Read-only export of the Replit production database.
# - pg_dump runs in a single REPEATABLE READ, READ ONLY transaction (consistent snapshot).
# - The session is additionally forced read-only.
# - Excludes Replit's _system schema and the contents of public.sessions.
# Usage: scripts/migration/export-production.sh [label]   (label defaults to "export")
source "$(dirname "$0")/_common.sh"
LABEL="${1:-export}"
read_url SOURCE_DATABASE_URL "Replit PRODUCTION connection string"

HOST="$(url_host "$SOURCE_DATABASE_URL")"
echo "Source host: $HOST"

# Gate: this must be Replit production (publish bookkeeping table present).
IS_PROD="$(psql_ro "$SOURCE_DATABASE_URL" -Atc "SELECT to_regclass('_system.replit_database_migrations_v1') IS NOT NULL")"
if [ "$IS_PROD" != "t" ]; then
  echo "REFUSING: _system.replit_database_migrations_v1 not found; this does not look like Replit production." >&2
  exit 1
fi
SERVER_MAJOR="$(psql_ro "$SOURCE_DATABASE_URL" -Atc "SELECT current_setting('server_version_num')::int / 10000")"
CLIENT_MAJOR="$("$PG_DUMP" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
echo "Server major: $SERVER_MAJOR, pg_dump major: $CLIENT_MAJOR"
[ "$CLIENT_MAJOR" -ge "$SERVER_MAJOR" ] || { echo "pg_dump is older than the server." >&2; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$MIGRATION_HOME/dumps/practice-toolbox-$LABEL-$STAMP.dump"
[ ! -e "$OUT" ] || { echo "$OUT already exists." >&2; exit 1; }

echo "Exporting to $OUT ..."
PGOPTIONS="$(ro_pgoptions)" "$PG_DUMP" \
  --dbname="$SOURCE_DATABASE_URL" \
  --format=custom --no-owner --no-privileges \
  --exclude-schema=_system \
  --exclude-table-data=public.sessions \
  --file="$OUT"

# Sanity checks on the dump's table of contents.
TOC="$("$PG_RESTORE" --list "$OUT")"
if printf '%s\n' "$TOC" | grep -qE ' _system '; then echo "FAIL: _system present in dump." >&2; exit 1; fi
if printf '%s\n' "$TOC" | grep -qE 'TABLE DATA public sessions '; then echo "FAIL: session rows present in dump." >&2; exit 1; fi
echo "Tables with data in dump: $(printf '%s\n' "$TOC" | grep -c 'TABLE DATA public ')"

(cd "$(dirname "$OUT")" && sha256_file "$(basename "$OUT")" > "$(basename "$OUT").sha256")
echo "Checksum: $(cat "$OUT.sha256")"
echo "Size: $(du -h "$OUT" | cut -f1)"
echo "Done. Keep this file private; never commit it."
