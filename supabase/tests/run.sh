#!/usr/bin/env bash
# Applies every migration to a SCRATCH Postgres database and runs the security assertions in rls.sql.
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres supabase/tests/run.sh
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a scratch Postgres database}"
case "$DATABASE_URL" in
  *@localhost*|*@127.0.0.1*|*@\[::1\]*|*host=/*) ;;
  *) echo "Refusing to run against a non-local database: this script creates roles and writes test data." >&2; exit 1 ;;
esac
here="$(cd "$(dirname "$0")" && pwd)"; root="$here/.."
psql_() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
psql_ -f "$here/stub.sql"
for f in "$root"/migrations/*.sql; do echo "apply $(basename "$f")"; psql_ -f "$f"; done
psql_ -f "$here/rls.sql"
echo "migrations and security assertions passed"
