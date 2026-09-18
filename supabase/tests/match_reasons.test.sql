-- Reasons on rejection and voiding (20260918140000_match_reasons.sql). The
-- overloads delegate to reject_match(uuid) and void_match(uuid), so these
-- checks cover the reason handling and that authorization still applies.

begin;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', name || '@example.com', 'x', now(), now(), now(),
       '{}'::jsonb, jsonb_build_object('display_name', name)
from (values
  ('11111111-1111-1111-1111-111111111111', 'Ada'),
  ('22222222-2222-2222-2222-222222222222', 'Bo')
) as people (id, name);

create function pg_temp.as_user(who text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.create_group('Tuesday Ladder');
reset role;
create temp table ctx as select id as g, invite_code as code from public.groups;
grant select on ctx to public;
set local role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.join_group_by_code((select code from ctx));

-- Ada submits two wins over Bo.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.submit_match((select g from ctx), '22222222-2222-2222-2222-222222222222',
  'completed', '11111111-1111-1111-1111-111111111111',
  '[{"set_number":1,"games_a":6,"games_b":2,"complete":true},{"set_number":2,"games_a":6,"games_b":3,"complete":true}]');
select public.submit_match((select g from ctx), '22222222-2222-2222-2222-222222222222',
  'completed', '11111111-1111-1111-1111-111111111111',
  '[{"set_number":1,"games_a":6,"games_b":4,"complete":true},{"set_number":2,"games_a":6,"games_b":4,"complete":true}]');
reset role;
create temp table m as select id, row_number() over (order by created_at, id) as n from public.matches;
grant select on m to public;
set local role authenticated;

select throws_ok(
  format($$ select public.reject_match(%L, 'Wrong score') $$, (select id from m where n = 1)),
  '42501', 'Only the opponent can reject',
  'a reason does not let the submitter reject their own match'
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok(
  format($$ select public.reject_match(%L, '  The second set was 6-4  ') $$,
         (select id from m where n = 1)),
  'the opponent can reject with a reason'
);
select is(
  (select status || ':' || rejection_reason from public.matches where id = (select id from m where n = 1)),
  'rejected:The second set was 6-4',
  'the rejection reason is stored, trimmed'
);

select public.confirm_match((select id from m where n = 2));
select throws_ok(
  format($$ select public.void_match(%L, 'Logged by mistake') $$, (select id from m where n = 2)),
  '42501', 'Only an organizer can void',
  'a reason does not let a player void'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format($$ select public.void_match(%L, '   ') $$, (select id from m where n = 2)),
  '22023', 'Give a reason for voiding the match',
  'voiding through the reasoned overload needs a reason'
);
select is(
  (select public.void_match((select id from m where n = 2), 'Logged by mistake')).void_reason,
  'Logged by mistake',
  'an organizer voids with the reason recorded'
);

select * from finish();
rollback;
