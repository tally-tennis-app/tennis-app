-- The derived rating fold (ADR 0002).
--
-- The load-bearing assertion is the backdating regression: confirming a
-- match with an old played_on date must not move any earlier rating.

begin;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ada@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Ada"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bo@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Bo"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cal@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Cal"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dee@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Dee"}'::jsonb);

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_group('Tuesday Ladder');

reset role;
create temp table ctx as select id as g, invite_code as code from public.groups;
grant select on ctx to public;
set local role authenticated;

set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.join_group_by_code((select code from ctx));
set local request.jwt.claims to
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select public.join_group_by_code((select code from ctx));
set local request.jwt.claims to
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_group('Elsewhere');

-- Match 1: Ada beats Bo 6-4 6-4, played yesterday, confirmed first.
set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.submit_match((select g from ctx), '22222222-2222-2222-2222-222222222222',
  current_date - 1, 'completed', '[{"a":6,"b":4},{"a":6,"b":4}]');

reset role;
create temp table m1 as select id from public.matches;
grant select on m1 to public;
set local role authenticated;

set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.confirm_match((select id from m1));

-- Between two 1500s the expected score is 0.5. Game share 12/20 = 0.6 gives a
-- multiplier of 1 + 0.25 x 0.1 x 2 = 1.05, so the change is 32 x 1.05 x 0.5.
select is(
  (select round(rating_after, 4) from public.rating_history()
   where match_id = (select id from m1)
     and player_id = '11111111-1111-1111-1111-111111111111'),
  1516.8000,
  'a 6-4 6-4 win between new players is worth 16.8'
);

select is(
  (select round(rating_after, 4) from public.rating_history()
   where match_id = (select id from m1)
     and player_id = '22222222-2222-2222-2222-222222222222'),
  1483.2000,
  'the loser drops by the same amount'
);

reset role;
create temp table before_backdate as
  select match_id, player_id, rating_before, rating_after
  from public.rating_fold(null);
grant select on before_backdate to public;
set local role authenticated;

-- Match 2: Bo beats Ada 6-0 6-0, played a month ago, confirmed now.
set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.submit_match((select g from ctx), '11111111-1111-1111-1111-111111111111',
  current_date - 30, 'completed', '[{"a":6,"b":0},{"a":6,"b":0}]');

reset role;
create temp table m2 as
  select id from public.matches where id <> (select id from m1);
grant select on m2 to public;
set local role authenticated;

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.confirm_match((select id from m2));

-- The ADR 0002 regression test.
select results_eq(
  $$ select h.match_id, h.player_id, h.rating_before, h.rating_after
     from public.rating_history() h
     where h.match_id = (select id from m1)
     order by h.player_id $$,
  $$ select match_id, player_id, rating_before, rating_after
     from before_backdate order by player_id $$,
  'confirming a backdated match does not move any earlier rating'
);

select is(
  (select round(rating_before, 4) from public.rating_history()
   where match_id = (select id from m2)
     and player_id = '22222222-2222-2222-2222-222222222222'),
  1483.2000,
  'the backdated match folds after the earlier confirmation, not by date played'
);

select ok(
  (select rating_after - rating_before from public.rating_history()
   where match_id = (select id from m2)
     and player_id = '22222222-2222-2222-2222-222222222222')
  between 21.9 and 22.0,
  'an upset 6-0 6-0 win earns the full 1.25 multiplier against a higher rating'
);

-- A walkover is confirmed but never rated.
select public.submit_match((select g from ctx), '44444444-4444-4444-4444-444444444444',
  current_date, 'walkover', '[]', '11111111-1111-1111-1111-111111111111');

reset role;
create temp table m3 as
  select id from public.matches where outcome = 'walkover';
grant select on m3 to public;
set local role authenticated;

set local request.jwt.claims to
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select public.confirm_match((select id from m3));

select is(
  (select count(*)::int from public.rating_history() where match_id = (select id from m3)),
  0,
  'a confirmed walkover is skipped by the fold'
);

-- ------------------------------------------------------------ standings

select is(
  (select played || ':' || wins || '-' || losses || ':' || form
   from public.standings((select g from ctx))
   where player_id = '11111111-1111-1111-1111-111111111111'),
  '2:1-1:LW',
  'standings report record and form, most recent first'
);

select is(
  (select round(rating)::int || ':' || played
   from public.standings((select g from ctx))
   where player_id = '44444444-4444-4444-4444-444444444444'),
  '1500:0',
  'a member with no rated match stands at the starting rating'
);

select is(
  (select count(*)::int from public.standings((select g from ctx))),
  3,
  'group standings list every active member'
);

-- ------------------------------------------------------------ privacy

set local request.jwt.claims to
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is(
  (select count(*)::int from public.standings((select g from ctx))),
  0,
  'an outsider gets no standings for a group they are not in'
);

select is(
  (select count(*)::int from public.rating_history()),
  0,
  'an outsider sees no rating history for matches they cannot open'
);

select is(
  (select array_agg(display_name) from public.standings()),
  array['Cal'],
  'global standings only list players who share a group with the caller'
);

-- ------------------------------------------------------------ voiding

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.void_match((select id from m2), 'Logged in the wrong group');

select is(
  (select round(rating, 4) from public.standings()
   where player_id = '11111111-1111-1111-1111-111111111111'),
  1516.8000,
  'a voided match drops out of the fold and later ratings recompute'
);

select is(
  (select count(*)::int from public.rating_history() where match_id = (select id from m2)),
  0,
  'a voided match has no rating change'
);

-- ------------------------------------------------------------ departure

set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.leave_group((select g from ctx));

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select is_active from public.standings((select g from ctx))
   where player_id = '22222222-2222-2222-2222-222222222222'),
  false,
  'a player who left stays in the group standings, marked inactive'
);

select * from finish();
rollback;
