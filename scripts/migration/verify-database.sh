#!/usr/bin/env bash
# Produce a read-only verification report for one database.
# Usage: scripts/migration/verify-database.sh LABEL     (e.g. source, staging, production)
# Writes $MIGRATION_HOME/reports/LABEL-<timestamp>.txt and prints its path.
source "$(dirname "$0")/_common.sh"
LABEL="${1:?Usage: verify-database.sh LABEL}"
read_url VERIFY_DATABASE_URL "Connection string for '$LABEL'"

OUT="$MIGRATION_HOME/reports/$LABEL-$(date -u +%Y%m%dT%H%M%SZ).txt"
echo "Host: $(url_host "$VERIFY_DATABASE_URL")"
psql_ro "$VERIFY_DATABASE_URL" -At -q -f "$SCRIPT_DIR/verify.sql" | grep '|' > "$OUT"

echo "Report: $OUT"
grep -E '^(meta|count)\|' "$OUT"
echo "tables with rows checked:    $(grep -c '^rows|' "$OUT")"
echo "tables checksummed:          $(grep -c '^md5|' "$OUT")"
echo "sequences checked:           $(grep -c '^seq|' "$OUT")"
BEHIND="$(grep '^seq|' "$OUT" | grep -c '|BEHIND$' || true)"
echo "sequences behind their data: $BEHIND"
