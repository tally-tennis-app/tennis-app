-- Row Level Security and verification rules for matches.
--
-- As in groups_rls.test.sql, every assertion that matters runs as the
-- unprivileged authenticated role with real JWT claims.

begin;

select plan(36);

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

-- Ada organizes a group that Bo and Dee join. Cal is an outsider.
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

-- ------------------------------------------------------------ submission

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  format($$ select public.submit_match(%L, %L, current_date, 'completed',
            '[{"a":6,"b":5},{"a":6,"b":4}]') $$,
         (select g from ctx), '22222222-2222-2222-2222-222222222222'),
  '22023',
  'Set 1: 6-5 is not a finished set. Sets end 6-0 to 6-4, 7-5, or 7-6',
  'an illegal set score is refused by the database'
);

select throws_ok(
  format($$ select public.submit_match(%L, %L, current_date, 'completed',
            '[{"a":6,"b":1},{"a":6,"b":2}]') $$,
         (select g from ctx), '33333333-3333-3333-3333-333333333333'),
  '22023',
  'Your opponent is not an active member of that group',
  'a player cannot log a match against someone outside the group'
);

select throws_ok(
  format($$ select public.submit_match(%L, %L, current_date, 'completed',
            '[{"a":6,"b":1},{"a":6,"b":2}]') $$,
         (select g from ctx), '11111111-1111-1111-1111-111111111111'),
  '22023',
  'Choose an opponent other than yourself',
  'a player cannot log a match against themselves'
);

select throws_ok(
  format($$ select public.submit_match(%L, %L, current_date + 7, 'completed',
            '[{"a":6,"b":1},{"a":6,"b":2}]') $$,
         (select g from ctx), '22222222-2222-2222-2222-222222222222'),
  '22023',
  'The date played cannot be in the future',
  'a match cannot be dated in the future'
);

select throws_ok(
  format($$ select public.submit_match(%L, %L, current_date, 'retired',
            '[{"a":6,"b":1},{"a":2,"b":1}]') $$,
         (select g from ctx), '22222222-2222-2222-2222-222222222222'),
  '22023',
  'Choose who won the match',
  'a retirement needs a named winner'
);

select lives_ok(
  format($$ select public.submit_match(%L, %L, current_date - 2, 'completed',
            '[{"a":6,"b":4},{"a":3,"b":6},{"a":7,"b":6,"tiebreak":5}]',
            null, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
         (select g from ctx), '22222222-2222-2222-2222-222222222222'),
  'a group member can submit a legal three-set score'
);

select lives_ok(
  format($$ select public.submit_match(%L, %L, current_date - 2, 'completed',
            '[{"a":6,"b":4},{"a":3,"b":6},{"a":7,"b":6,"tiebreak":5}]',
            null, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
         (select g from ctx), '22222222-2222-2222-2222-222222222222'),
  'resending the same request succeeds'
);

select is(
  (select count(*)::int from public.matches),
  1,
  'a resent request does not create a duplicate match'
);

reset role;
create temp table m as select id from public.matches;
grant select on m to public;
set local role authenticated;

select is(
  (select winner_id from public.matches),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the database derives the winner of a completed match from its sets'
);

select is(
  (select count(*)::int from public.match_sets),
  3,
  'the submitter can read the sets they wrote'
);

select throws_ok(
  format($$ insert into public.matches (group_id, submitted_by, opponent_id,
            winner_id, outcome, played_on)
            values (%L, %L, %L, %L, 'walkover', current_date) $$,
         (select g from ctx), '11111111-1111-1111-1111-111111111111',
         '22222222-2222-2222-2222-222222222222',
         '11111111-1111-1111-1111-111111111111'),
  '42501',
  null,
  'a direct insert bypassing submit_match() is refused'
);

update public.matches set status = 'confirmed', confirmed_at = now();

select is(
  (select status from public.matches),
  'pending',
  'a submitter cannot confirm their own match with a direct update'
);

select throws_ok(
  format('select public.confirm_match(%L)', (select id from m)),
  '42501',
  'Only the opponent can confirm or reject a match',
  'a submitter cannot confirm their own match through the function'
);

-- ------------------------------------------------------------ visibility

set local request.jwt.claims to
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is(
  (select count(*)::int from public.matches),
  0,
  'an outsider cannot see the group''s matches'
);

select is(
  (select count(*)::int from public.match_sets),
  0,
  'an outsider cannot see the sets of those matches'
);

set local request.jwt.claims to
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select is(
  (select count(*)::int from public.matches),
  1,
  'another member of the group can see the match'
);

select throws_ok(
  format('select public.confirm_match(%L)', (select id from m)),
  '42501',
  'Only the opponent can confirm or reject a match',
  'a third member cannot confirm someone else''s match'
);

-- ------------------------------------------------------------ reject, edit

set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select lives_ok(
  format($$ select public.reject_match(%L, 'The second set was 6-2') $$,
         (select id from m)),
  'the opponent can reject a pending match'
);

select is(
  (select status || ':' || rejection_reason from public.matches),
  'rejected:The second set was 6-2',
  'a rejection records its reason'
);

select throws_ok(
  format($$ select public.update_match(%L, current_date, 'completed',
            '[{"a":6,"b":1},{"a":6,"b":1}]') $$,
         (select id from m)),
  '42501',
  'Only the player who submitted a match can edit it',
  'the opponent cannot edit the submitted score'
);

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  format($$ select public.update_match(%L, current_date - 2, 'completed',
            '[{"a":6,"b":4},{"a":2,"b":6},{"a":7,"b":6,"tiebreak":5}]') $$,
         (select id from m)),
  'the submitter can correct a rejected match'
);

select is(
  (select status || ':' || coalesce(rejection_reason, 'none') from public.matches),
  'pending:none',
  'a correction goes back to pending and clears the rejection'
);

select is(
  (select opponent_games from public.match_sets where set_number = 2),
  6::smallint,
  'the corrected sets replace the old ones'
);

-- ------------------------------------------------------------ confirmation

set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select lives_ok(
  format('select public.confirm_match(%L)', (select id from m)),
  'the opponent can confirm the corrected match'
);

select isnt(
  (select confirmed_at from public.matches),
  null,
  'confirmation records when it happened'
);

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  format($$ select public.update_match(%L, current_date, 'completed',
            '[{"a":6,"b":0},{"a":6,"b":0}]') $$,
         (select id from m)),
  '42501',
  'A confirmed match cannot be changed',
  'the submitter cannot edit a confirmed match'
);

select throws_ok(
  format('select public.withdraw_match(%L)', (select id from m)),
  '42501',
  'A confirmed match cannot be withdrawn',
  'the submitter cannot withdraw a confirmed match'
);

reset role;

select throws_ok(
  $$ update public.matches set played_on = played_on - 30 $$,
  '42501',
  'A confirmed match cannot be changed',
  'even the table owner cannot redate a confirmed match'
);

select throws_ok(
  $$ update public.match_sets set submitter_games = 0 where set_number = 1 $$,
  '42501',
  'A confirmed match cannot be changed',
  'even the table owner cannot rewrite a confirmed score'
);

-- ------------------------------------------------------------ voiding

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  format($$ select public.void_match(%L, 'Wrong players') $$, (select id from m)),
  '42501',
  'Only an organizer of this group can void a match',
  'a player cannot void a match'
);

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  format($$ select public.void_match(%L, '   ') $$, (select id from m)),
  '22023',
  'Give a reason for voiding the match',
  'voiding needs a reason'
);

select lives_ok(
  format($$ select public.void_match(%L, 'Logged in the wrong group') $$,
         (select id from m)),
  'an organizer can void a confirmed match'
);

select is(
  (select array_agg(submitter_games::int order by set_number) from public.match_sets),
  array[6, 2, 7],
  'voiding leaves the score exactly as confirmed'
);

-- ------------------------------------------------------------ expiry

select public.submit_match((select g from ctx), '44444444-4444-4444-4444-444444444444',
  current_date, 'walkover', '[]', '11111111-1111-1111-1111-111111111111');

reset role;
update public.matches set submitted_at = now() - interval '15 days'
where opponent_id = '44444444-4444-4444-4444-444444444444';

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select throws_ok(
  format('select public.confirm_match(%L)',
         (select id from public.matches
          where opponent_id = '44444444-4444-4444-4444-444444444444')),
  '23514',
  'That submission expired after 14 days. Ask your opponent to submit it again',
  'a submission older than 14 days can no longer be confirmed'
);

-- ------------------------------------------------------------ deletion

reset role;

select lives_ok(
  $$ delete from auth.users where id = '22222222-2222-2222-2222-222222222222' $$,
  'deleting an account still cascades through a confirmed match (ADR 0002)'
);

select is(
  (select count(*)::int from public.matches where id = (select id from m)),
  0,
  'the deleted player''s matches are gone'
);

select * from finish();
rollback;
