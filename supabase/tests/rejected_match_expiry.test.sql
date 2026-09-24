-- A rejection disappears five days after it was rejected
-- (20260923120100_rejected_match_expiry.sql). The filter lives in the select
-- policies, so these checks run as each player rather than as the owner: an
-- owner-side query bypasses RLS and would prove nothing.

begin;

select plan(11);

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

-- Ada submits two results; Bo rejects both, one with a reason.
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

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.reject_match((select id from m where n = 1));
select public.reject_match((select id from m where n = 2), 'Second set was 6-4');
reset role;

select isnt(
  (select rejected_at from public.matches where id = (select id from m where n = 1)),
  null, 'reject_match records when it happened');
select isnt(
  (select rejected_at from public.matches where id = (select id from m where n = 2)),
  null, 'the reasoned overload records it too');

-- Fresh rejections stay visible to both players, reason included.
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.matches where status = 'rejected'), 2,
  'the submitter sees a fresh rejection');
select is((select rejection_reason from public.matches where id = (select id from m where n = 2)),
  'Second set was 6-4', 'the submitter can read the reason');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.matches where status = 'rejected'), 2,
  'the opponent sees a fresh rejection');
reset role;

-- Four days old is still inside the window.
update public.matches set rejected_at = now() - interval '4 days'
where id = (select id from m where n = 1);
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.matches where id = (select id from m where n = 1)), 1,
  'a four day old rejection is still visible');
reset role;

-- Six days old is gone, and so is its score.
update public.matches set rejected_at = now() - interval '6 days'
where id = (select id from m where n = 1);
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.matches where id = (select id from m where n = 1)), 0,
  'the submitter no longer sees a six day old rejection');
select is((select count(*)::int from public.match_sets where match_id = (select id from m where n = 1)), 0,
  'a hidden rejection does not leak its sets');
select is((select count(*)::int from public.matches where status = 'rejected'), 1,
  'the newer rejection is unaffected');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.matches where id = (select id from m where n = 1)), 0,
  'the opponent no longer sees it either');
reset role;

-- The row is hidden, not deleted: nothing here removes match history.
select is((select count(*)::int from public.matches where id = (select id from m where n = 1)), 1,
  'the row still exists for the owner');

select * from finish();
rollback;
