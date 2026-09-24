#!/usr/bin/env bash
# Compare two verification reports. Exit 0 = PASS, 1 = FAIL.
# Usage: scripts/migration/compare-reports.sh SOURCE_REPORT TARGET_REPORT
set -euo pipefail
A="${1:?Usage: compare-reports.sh SOURCE_REPORT TARGET_REPORT}"
B="${2:?Usage: compare-reports.sh SOURCE_REPORT TARGET_REPORT}"

# Expected differences: session rows are intentionally not migrated;
# extension lists are reported as a warning only.
filter() { grep -vE '^rows\|sessions\||^meta\|extensions\|' "$1" | sort; }

echo "Session rows: source $(grep '^rows|sessions|' "$A" | cut -d'|' -f3), target $(grep '^rows|sessions|' "$B" | cut -d'|' -f3) (target is expected to be 0)"
EXT_A="$(grep '^meta|extensions|' "$A" | cut -d'|' -f3)"; EXT_B="$(grep '^meta|extensions|' "$B" | cut -d'|' -f3)"
[ "$EXT_A" = "$EXT_B" ] || echo "WARNING extensions differ: source [$EXT_A] target [$EXT_B]"
[ "$(grep '^rows|sessions|' "$B" | cut -d'|' -f3)" = "0" ] || echo "WARNING: target has session rows."

if grep -q '|BEHIND$' "$B"; then echo "FAIL: a target sequence is behind its data."; grep '|BEHIND$' "$B"; exit 1; fi

if DIFF="$(diff <(filter "$A") <(filter "$B"))"; then
  echo "PASS: row counts, table checksums, sequences, constraints, indexes, object counts and time zone all match."
  exit 0
else
  echo "FAIL: differences (< source, > target):"
  printf '%s\n' "$DIFF"
  exit 1
fi
