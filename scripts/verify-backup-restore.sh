#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly SUPABASE_CLI="$REPO_ROOT/node_modules/.bin/supabase"
readonly SOURCE_PROJECT_ID="tennisapp-restore-source"
readonly TARGET_PROJECT_ID="tennisapp-restore-target"
readonly SOURCE_DB_PORT="${SOURCE_DB_PORT:-56432}"
readonly TARGET_DB_PORT="${TARGET_DB_PORT:-57432}"
readonly EXCLUDED_SERVICES="gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
readonly PROTECTED_PROJECT_IDS="TennisApp tennis-nextsteps-codex"
readonly PROTECTED_PORTS="54321 54322 55321 55322"

KEEP_ARTIFACTS=0
RUN_POLICY_TESTS=1

usage() {
  printf '%s\n' \
    "Usage: scripts/verify-backup-restore.sh [--keep-artifacts] [--skip-policy-tests]" \
    "" \
    "Creates only disposable local Supabase projects. It never reads or writes a" \
    "linked or hosted project. --keep-artifacts retains the private temporary" \
    "directory for debugging; it may contain synthetic database dumps."
}

while (($# > 0)); do
  case "$1" in
    --keep-artifacts) KEEP_ARTIFACTS=1 ;;
    --skip-policy-tests) RUN_POLICY_TESTS=0 ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 64 ;;
  esac
  shift
done

for required in docker awk diff shasum; do
  command -v "$required" >/dev/null || {
    printf 'Required command is missing: %s\n' "$required" >&2
    exit 69
  }
done

[[ -x "$SUPABASE_CLI" ]] || {
  printf 'Run npm ci before the restore drill; Supabase CLI is missing.\n' >&2
  exit 69
}

for project_id in $PROTECTED_PROJECT_IDS; do
  [[ "$SOURCE_PROJECT_ID" != "$project_id" && "$TARGET_PROJECT_ID" != "$project_id" ]] || {
    printf 'Refusing protected project id: %s\n' "$project_id" >&2
    exit 78
  }
done

for port in "$SOURCE_DB_PORT" "$TARGET_DB_PORT"; do
  [[ "$port" =~ ^[0-9]+$ ]] && ((port >= 1024 && port <= 65535)) || {
    printf 'Invalid drill port: %s\n' "$port" >&2
    exit 78
  }
  for protected_port in $PROTECTED_PORTS; do
    [[ "$port" != "$protected_port" ]] || {
      printf 'Refusing protected port: %s\n' "$port" >&2
      exit 78
    }
  done
done

[[ "$SOURCE_DB_PORT" != "$TARGET_DB_PORT" ]] || {
  printf 'Source and target ports must be different.\n' >&2
  exit 78
}

readonly DRILL_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/tennisapp-restore-drill.XXXXXX")"
readonly SOURCE_ROOT="$DRILL_ROOT/source"
readonly TARGET_ROOT="$DRILL_ROOT/target"
readonly BACKUP_ROOT="$DRILL_ROOT/backup"
readonly SOURCE_CONTAINER="supabase_db_${SOURCE_PROJECT_ID}"
readonly TARGET_CONTAINER="supabase_db_${TARGET_PROJECT_ID}"
readonly SOURCE_DB_URL="postgresql://postgres:postgres@127.0.0.1:${SOURCE_DB_PORT}/postgres"
readonly TARGET_DB_URL="postgresql://postgres:postgres@127.0.0.1:${TARGET_DB_PORT}/postgres"

source_started=0
target_started=0

safe_stop() {
  local workdir="$1"
  local expected_id="$2"
  [[ "$workdir" == "$DRILL_ROOT"/* ]] || return 0
  [[ -f "$workdir/supabase/config.toml" ]] || return 0
  grep -Fq "project_id = \"$expected_id\"" "$workdir/supabase/config.toml" || return 0
  "$SUPABASE_CLI" stop --workdir "$workdir" --no-backup >/dev/null 2>&1 || true
}

cleanup() {
  if ((target_started)); then safe_stop "$TARGET_ROOT" "$TARGET_PROJECT_ID"; fi
  if ((source_started)); then safe_stop "$SOURCE_ROOT" "$SOURCE_PROJECT_ID"; fi

  if ((KEEP_ARTIFACTS)); then
    printf 'Private drill artifacts retained at %s\n' "$DRILL_ROOT"
  elif [[ "$(basename "$DRILL_ROOT")" == tennisapp-restore-drill.* ]]; then
    rm -rf -- "$DRILL_ROOT"
  fi
}
trap cleanup EXIT

mkdir -p "$SOURCE_ROOT/supabase/migrations" "$SOURCE_ROOT/supabase/tests" \
  "$TARGET_ROOT/supabase/migrations" "$TARGET_ROOT/supabase/tests" \
  "$BACKUP_ROOT"

write_config() {
  local destination="$1"
  local project_id="$2"
  local db_port="$3"
  local shadow_port=$((db_port - 2))

  awk -v project_id="$project_id" -v db_port="$db_port" -v shadow_port="$shadow_port" '
    /^\[/ { section = $0 }
    /^project_id = / { print "project_id = \"" project_id "\""; next }
    section == "[db]" && /^port = / { print "port = " db_port; next }
    section == "[db]" && /^shadow_port = / { print "shadow_port = " shadow_port; next }
    section == "[db.seed]" && /^enabled = / { print "enabled = false"; next }
    { print }
  ' "$REPO_ROOT/supabase/config.toml" > "$destination"
}

write_config "$SOURCE_ROOT/supabase/config.toml" "$SOURCE_PROJECT_ID" "$SOURCE_DB_PORT"
write_config "$TARGET_ROOT/supabase/config.toml" "$TARGET_PROJECT_ID" "$TARGET_DB_PORT"
cp "$REPO_ROOT"/supabase/migrations/*.sql "$SOURCE_ROOT/supabase/migrations/"
cp "$REPO_ROOT"/supabase/tests/*.sql "$SOURCE_ROOT/supabase/tests/"
cp "$REPO_ROOT"/supabase/tests/*.sql "$TARGET_ROOT/supabase/tests/"

assert_isolated_config() {
  local workdir="$1"
  local expected_id="$2"
  local expected_port="$3"
  local config="$workdir/supabase/config.toml"

  [[ "$workdir" == "$DRILL_ROOT"/* && -f "$config" ]]
  grep -Fq "project_id = \"$expected_id\"" "$config"
  awk -v wanted="$expected_port" '
    /^\[/ { section = $0 }
    section == "[db]" && /^port = / { found = ($3 == wanted) }
    END { exit found ? 0 : 1 }
  ' "$config"
}

assert_loopback_url() {
  local url="$1"
  local port="$2"
  [[ "$url" == "postgresql://postgres:postgres@127.0.0.1:${port}/postgres" ]] || {
    printf 'Refusing non-loopback or unexpected database target.\n' >&2
    exit 78
  }
}

assert_isolated_config "$SOURCE_ROOT" "$SOURCE_PROJECT_ID" "$SOURCE_DB_PORT"
assert_isolated_config "$TARGET_ROOT" "$TARGET_PROJECT_ID" "$TARGET_DB_PORT"
assert_loopback_url "$SOURCE_DB_URL" "$SOURCE_DB_PORT"
assert_loopback_url "$TARGET_DB_URL" "$TARGET_DB_PORT"

printf 'Restore drill source: %s on loopback port %s\n' "$SOURCE_PROJECT_ID" "$SOURCE_DB_PORT"
printf 'Restore drill target: %s on loopback port %s\n' "$TARGET_PROJECT_ID" "$TARGET_DB_PORT"
printf 'Protected active project and ports will not be touched.\n'

for container in "$SOURCE_CONTAINER" "$TARGET_CONTAINER"; do
  if docker container inspect "$container" >/dev/null 2>&1; then
    printf 'Refusing existing drill container: %s\n' "$container" >&2
    exit 78
  fi
done
source_started=1
"$SUPABASE_CLI" start --workdir "$SOURCE_ROOT" --exclude "$EXCLUDED_SERVICES"
source_started=1

docker exec -i "$SOURCE_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'restore-a@example.test', '{"display_name":"Restore A"}'),
  ('10000000-0000-0000-0000-000000000002', 'restore-b@example.test', '{"display_name":"Restore B"}'),
  ('10000000-0000-0000-0000-000000000003', 'restore-c@example.test', '{"display_name":"Restore C"}');

insert into public.groups (id, name, invite_code, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Restore drill', 'RESTORE1',
   '10000000-0000-0000-0000-000000000001');

insert into public.group_members (group_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'player'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'player');

insert into public.matches
  (id, group_id, player_a, player_b, played_on, outcome, winner, status,
   submitted_by, confirmed_at, voided_at, voided_by, created_at)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   current_date - 3, 'completed', '10000000-0000-0000-0000-000000000001', 'confirmed',
   '10000000-0000-0000-0000-000000000001', now() - interval '2 days', null, null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003',
   current_date - 2, 'completed', '10000000-0000-0000-0000-000000000002', 'pending',
   '10000000-0000-0000-0000-000000000002', null, null, null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   current_date - 1, 'completed', '10000000-0000-0000-0000-000000000003', 'confirmed',
   '10000000-0000-0000-0000-000000000003', now() - interval '1 day', now(),
   '10000000-0000-0000-0000-000000000001', now() - interval '1 day');

insert into public.match_sets
  (match_id, set_number, games_a, games_b, tiebreak_a, tiebreak_b, complete)
values
  ('30000000-0000-0000-0000-000000000001', 1, 6, 0, null, null, true),
  ('30000000-0000-0000-0000-000000000001', 2, 6, 0, null, null, true),
  ('30000000-0000-0000-0000-000000000002', 1, 6, 4, null, null, true),
  ('30000000-0000-0000-0000-000000000002', 2, 6, 4, null, null, true),
  ('30000000-0000-0000-0000-000000000003', 1, 0, 6, null, null, true),
  ('30000000-0000-0000-0000-000000000003', 2, 0, 6, null, null, true);
SQL

snapshot() {
  local container="$1"
  local output="$2"
  docker exec -i "$container" psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d postgres > "$output" <<'SQL'
select 'counts|' || concat_ws(',',
  (select count(*) from auth.users),
  (select count(*) from public.profiles),
  (select count(*) from public.groups),
  (select count(*) from public.group_members),
  (select count(*) from public.matches),
  (select count(*) from public.match_sets));
select 'content|' || md5(concat_ws('|',
  (select string_agg(md5(row_to_json(x)::text), '' order by id) from auth.users x),
  (select string_agg(md5(row_to_json(x)::text), '' order by id) from public.profiles x),
  (select string_agg(md5(row_to_json(x)::text), '' order by id) from public.groups x),
  (select string_agg(md5(row_to_json(x)::text), '' order by group_id, user_id) from public.group_members x),
  (select string_agg(md5(row_to_json(x)::text), '' order by id) from public.matches x),
  (select string_agg(md5(row_to_json(x)::text), '' order by match_id, set_number) from public.match_sets x)));
select 'schema|' || md5(string_agg(item, E'\n' order by item)) from (
  select table_schema || '.table.' || table_name || '.' || column_name || '.' || data_type || '.' || is_nullable item
  from information_schema.columns where table_schema in ('public','private')
  union all
  select n.nspname || '.function.' || p.proname || '.' || pg_get_function_identity_arguments(p.oid) || '.' || pg_get_function_result(p.oid)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
  union all
  select schemaname || '.view.' || viewname || '.' || definition from pg_views where schemaname='public'
  union all
  select n.nspname || '.trigger.' || t.tgname || '.' || pg_get_triggerdef(t.oid)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace pn on pn.oid = p.pronamespace
  where not t.tgisinternal
    and n.nspname in ('auth','storage')
    and pn.nspname in ('public','private')
) metadata;
select 'security|' || md5(string_agg(item, E'\n' order by item)) from (
  select n.nspname || '.rls.' || c.relname || '.' || c.relrowsecurity item
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
  union all
  select schemaname || '.policy.' || tablename || '.' || policyname || '.' || cmd || '.' || roles::text || '.' || coalesce(qual,'') || '.' || coalesce(with_check,'')
  from pg_policies where schemaname='public'
  union all
  select routine_schema || '.grant.' || routine_name || '.' || grantee || '.' || privilege_type
  from information_schema.routine_privileges where routine_schema in ('public','private')
  union all
  select table_schema || '.grant.' || table_name || '.' || grantee || '.' || privilege_type
  from information_schema.table_privileges where table_schema in ('public','private')
) security_metadata;
begin;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select 'ratings|' || md5(string_agg(player_id::text || ':' || round(rating::numeric,6)::text || ':' || matches_played::text, ',' order by player_id))
from public.get_ratings(null);
rollback;
SQL
}

snapshot "$SOURCE_CONTAINER" "$DRILL_ROOT/source.snapshot"

"$SUPABASE_CLI" db dump --local --workdir "$SOURCE_ROOT" --file "$BACKUP_ROOT/roles.sql" --role-only
"$SUPABASE_CLI" db dump --local --workdir "$SOURCE_ROOT" --file "$BACKUP_ROOT/schema.sql"
"$SUPABASE_CLI" db dump --local --workdir "$SOURCE_ROOT" --file "$BACKUP_ROOT/data.sql" \
  --use-copy --data-only --exclude "storage.buckets_vectors" --exclude "storage.vector_indexes"

# The standard application-schema dump deliberately excludes Supabase-managed
# auth/storage schemas. Preserve only application-owned triggers attached there.
docker exec -i "$SOURCE_CONTAINER" psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
  > "$BACKUP_ROOT/auth-storage-triggers.sql" <<'SQL'
select pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where not t.tgisinternal
  and n.nspname in ('auth','storage')
  and pn.nspname in ('public','private')
order by n.nspname, c.relname, t.tgname;
SQL

shasum -a 256 "$BACKUP_ROOT"/*.sql > "$DRILL_ROOT/backup.sha256"

# A clean local Supabase target already owns its platform roles. Its postgres
# login cannot re-grant this platform-level parameter privilege, even though
# db dump includes it. Preserve the original backup and omit only that bootstrap
# statement for the disposable local restore; all application/custom roles and
# role settings remain strict.
awk '!/^GRANT SET ON PARAMETER .* TO "supabase_realtime_admin";/' \
  "$BACKUP_ROOT/roles.sql" > "$DRILL_ROOT/roles.local-restore.sql"

safe_stop "$SOURCE_ROOT" "$SOURCE_PROJECT_ID"
source_started=0

target_started=1
"$SUPABASE_CLI" start --workdir "$TARGET_ROOT" --exclude "$EXCLUDED_SERVICES"

docker exec -i "$TARGET_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /dev/stdin < "$DRILL_ROOT/roles.local-restore.sql"
# A fresh project grants function execution to the API roles by default.
# Revoke those defaults during object creation so the dump's explicit ACLs
# reproduce the source, including internal functions hidden from API roles.
docker exec -i "$TARGET_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
SQL
docker exec -i "$TARGET_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /dev/stdin < "$BACKUP_ROOT/schema.sql"
docker exec -i "$TARGET_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /dev/stdin < "$BACKUP_ROOT/auth-storage-triggers.sql"
docker exec -i "$TARGET_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  --single-transaction -c 'set session_replication_role = replica' \
  -f /dev/stdin < "$BACKUP_ROOT/data.sql"

snapshot "$TARGET_CONTAINER" "$DRILL_ROOT/target.snapshot"
diff -u "$DRILL_ROOT/source.snapshot" "$DRILL_ROOT/target.snapshot"

if ((RUN_POLICY_TESTS)); then
  "$SUPABASE_CLI" test db --local --workdir "$TARGET_ROOT"
fi

printf 'Backup checksums:\n'
cat "$DRILL_ROOT/backup.sha256"
printf 'Verified snapshot:\n'
cat "$DRILL_ROOT/target.snapshot"
printf 'Backup/restore drill passed. Source and target snapshots match.\n'
