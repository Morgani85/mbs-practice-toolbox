#!/usr/bin/env bash
# Shared helpers for the Replit -> Railway database migration scripts.
# See docs/migration/DATABASE-CUTOVER-RUNBOOK.md. Never commit dumps or reports.
set -euo pipefail
umask 077

# PostgreSQL 16 client tools (Homebrew postgresql@16), falling back to PATH.
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
if [ -x "$PG_BIN/psql" ]; then
  PSQL="$PG_BIN/psql"; PG_DUMP="$PG_BIN/pg_dump"; PG_RESTORE="$PG_BIN/pg_restore"
else
  PSQL="$(command -v psql)"; PG_DUMP="$(command -v pg_dump)"; PG_RESTORE="$(command -v pg_restore)"
fi

# Dumps and reports live outside the repository.
MIGRATION_HOME="${MIGRATION_HOME:-$HOME/MBS-migration}"
mkdir -p "$MIGRATION_HOME/dumps" "$MIGRATION_HOME/reports"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# read_url VAR "Prompt": uses $VAR if already exported, otherwise asks with hidden input.
# The value is never echoed.
read_url() {
  local var="$1" prompt="$2"
  if [ -z "${!var:-}" ]; then
    read -r -s -p "$prompt (input hidden): " "$var"; echo
    export "$var"
  fi
  if [ -z "${!var:-}" ]; then echo "No connection string given." >&2; exit 1; fi
}

# url_host URL: prints only the host part (no user, password or database).
url_host() {
  printf '%s' "$1" | sed -E 's#^[a-z]+://##; s#^[^@]*@##; s#[:/?].*$##'
}

# Replit / Neon hosts must never be written to.
is_replit_host() {
  case "$1" in
    *replit*|*repl.co*|*helium*|*neon.tech*) return 0 ;;
    *) return 1 ;;
  esac
}

# Read-only psql: every transaction in the session is READ ONLY.
# If a managed server rejects startup options, set NO_STARTUP_OPTIONS=1; pg_dump and
# verify.sql still run inside explicit READ ONLY transactions.
ro_pgoptions() { [ "${NO_STARTUP_OPTIONS:-0}" = "1" ] && echo "" || echo "-c default_transaction_read_only=on"; }
psql_ro() {
  local url="$1"; shift
  PGOPTIONS="$(ro_pgoptions)" "$PSQL" --no-psqlrc -X -v ON_ERROR_STOP=1 --dbname="$url" "$@"
}

# Read-write psql (targets only).
psql_rw() {
  local url="$1"; shift
  "$PSQL" --no-psqlrc -X -v ON_ERROR_STOP=1 --dbname="$url" "$@"
}

sha256_file() { shasum -a 256 "$1"; }

confirm_word() {
  local word="$1" answer
  read -r -p "Type '$word' to continue: " answer
  [ "$answer" = "$word" ] || { echo "Cancelled."; exit 1; }
}
