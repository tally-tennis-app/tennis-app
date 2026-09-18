-- Single-elimination tournaments (ADR 0003), run as real players.

begin;

select plan(36);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', name || '@example.com', 'x', now(), now(), now(),
       '{}'::jsonb, jsonb_build_object('display_name', name)
from (values
  ('11111111-1111-1111-1111-111111111111', 'Ada'),
  ('22222222-2222-2222-2222-222222222222', 'Bo'),
  ('33333333-3333-3333-3333-333333333333', 'Cal'),
  ('44444444-4444-4444-4444-444444444444', 'Dee'),
  ('55555555-5555-5555-5555-555555555555', 'Eve')
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
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.join_group_by_code((select code from ctx));
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.join_group_by_code((select code from ctx));
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select public.create_group('Elsewhere');

-- ------------------------------------------------------------ creation

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format($$ select public.create_tournament(%L, 'Club Cup', 4) $$, (select g from ctx)),
  '42501', 'Only an organizer of this group can create a tournament',
  'a player cannot create a tournament'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format($$ select public.create_tournament(%L, 'Club Cup', 6) $$, (select g from ctx)),
  '22023', 'The entrant limit must be 4, 8, 16, or 32',
  'the entrant limit must be a supported draw size'
);
select lives_ok(
  format($$ select public.create_tournament(%L, 'Club Cup', 4) $$, (select g from ctx)),
  'an organizer can create a tournament'
);

reset role;
create temp table t1 as select id from public.tournaments;
grant select on t1 to public;
set local role authenticated;

-- ------------------------------------------------------------ registration

select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select is((select count(*)::int from public.tournaments), 0,
  'an outsider cannot see the group''s tournament');
select throws_ok(
  format('select public.register_for_tournament(%L)', (select id from t1)),
  '42501', 'Only members of the group can enter this tournament',
  'an outsider cannot register'
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok(format('select public.register_for_tournament(%L)', (select id from t1)),
  'a member can register');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.register_for_tournament((select id from t1));
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.register_for_tournament((select id from t1));

select throws_ok(
  format('select public.start_tournament(%L)', (select id from t1)),
  '42501', 'Only an organizer of this group can manage the tournament',
  'a player cannot make the draw'
);

-- ------------------------------------------------------------ draw

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok(format('select public.start_tournament(%L)', (select id from t1)),
  'the organizer can close registration and make the draw');

select is(
  (select status || ':' || draw_size from public.tournaments where id = (select id from t1)),
  'in_progress:4',
  'three entrants play a draw of four, not the cap'
);
select is((select count(*)::int from public.tournament_ties), 3,
  'a draw of four has two semifinals and a final');

-- Everyone is unrated, so seeding falls back to registration order: Bo is 1.
select is(
  (select decided_by || ':' || winner_id::text from public.tournament_ties
   where round = 1 and position = 0),
  'bye:22222222-2222-2222-2222-222222222222',
  'the top seed gets the bye'
);
select is(
  (select player_a from public.tournament_ties where round = 2),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'the bye winner is already in the final'
);

reset role;
create temp table semi as
  select id from public.tournament_ties where round = 1 and position = 1;
create temp table final as select id from public.tournament_ties where round = 2;
grant select on semi, final to public;
set local role authenticated;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format('select public.register_for_tournament(%L)', (select id from t1)),
  '23514', 'Registration for this tournament is closed',
  'registration closes when the draw is made'
);

-- ------------------------------------------------------------ results

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format($$ select public.submit_tournament_match(%L, current_date, 'completed',
            '[{"a":6,"b":1},{"a":6,"b":1}]') $$, (select id from semi)),
  '42501', 'Only the two players in this tie can submit its result',
  'only the tie''s players can submit its result'
);

-- Cal is seed 2 and Dee seed 3 in the other semifinal.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok(
  format($$ select public.submit_tournament_match(%L, current_date, 'completed',
            '[{"a":6,"b":3},{"a":6,"b":4}]') $$, (select id from semi)),
  'a player in the tie can submit its result'
);
select throws_ok(
  format($$ select public.submit_tournament_match(%L, current_date, 'completed',
            '[{"a":6,"b":0},{"a":6,"b":0}]') $$, (select id from semi)),
  '23514', 'A result for this tie is already waiting. Confirm, reject, or correct it instead',
  'a tie takes one live result at a time'
);

reset role;
create temp table semi_match as select match_id as id from public.tournament_ties
  where id = (select id from semi);
grant select on semi_match to public;
set local role authenticated;

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.confirm_match((select id from semi_match));

select is(
  (select player_b from public.tournament_ties where id = (select id from final)),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'confirming the result advances the winner'
);

select is(
  (select count(*)::int from public.rating_history()
   where match_id = (select id from semi_match)),
  2,
  'a tournament match counts toward ratings like any other'
);

-- ------------------------------------------------------------ voiding

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok(
  format($$ select public.void_match(%L, 'Wrong score entered') $$,
         (select id from semi_match)),
  'an organizer can void a result before the next round has one'
);
select is(
  (select coalesce(player_b::text, 'empty') from public.tournament_ties
   where id = (select id from final)),
  'empty',
  'voiding takes the winner back out of the next round'
);
select is(
  (select decided_at from public.tournament_ties where id = (select id from semi)),
  null,
  'the voided tie reopens for a new result'
);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.submit_tournament_match((select id from semi), current_date, 'completed',
  '[{"a":6,"b":2},{"a":6,"b":2}]');
reset role;
create temp table semi_match2 as select match_id as id from public.tournament_ties
  where id = (select id from semi);
grant select on semi_match2 to public;
set local role authenticated;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.confirm_match((select id from semi_match2));

-- Final: Bo beats Cal.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_tournament_match((select id from final), current_date, 'completed',
  '[{"a":7,"b":5},{"a":6,"b":4}]');
reset role;
create temp table final_match as select match_id as id from public.tournament_ties
  where id = (select id from final);
grant select on final_match to public;
set local role authenticated;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format($$ select public.void_match(%L, 'Too late') $$, (select id from semi_match2)),
  '23514', 'The next round already has a result, so this match stands',
  'a result cannot be voided once the next round has one'
);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.confirm_match((select id from final_match));

select is(
  (select status || ':' || champion_id::text from public.tournaments where id = (select id from t1)),
  'completed:22222222-2222-2222-2222-222222222222',
  'confirming the final completes the tournament and crowns the champion'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok(
  format($$ select public.void_match(%L, 'Played the wrong set format') $$,
         (select id from final_match)),
  'the final can be voided'
);
select is(
  (select status || ':' || coalesce(champion_id::text, 'none')
   from public.tournaments where id = (select id from t1)),
  'in_progress:none',
  'voiding the final reopens it and clears the champion'
);
select is(
  (select count(*)::int from public.tournament_events
   where tournament_id = (select id from t1) and kind = 'result_voided'),
  2,
  'each voided result is recorded'
);

-- ------------------------------------------------------------ withdrawal

select public.create_tournament((select g from ctx), 'Short Cup', 4);
reset role;
create temp table t2 as select id from public.tournaments where name = 'Short Cup';
grant select on t2 to public;
set local role authenticated;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.register_for_tournament((select id from t2));
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.register_for_tournament((select id from t2));
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.start_tournament((select id from t2));

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select throws_ok(
  format($$ select public.withdraw_from_tournament(%L, %L) $$,
         (select id from t2), '22222222-2222-2222-2222-222222222222'),
  '42501', 'Only an organizer can withdraw another player',
  'a player cannot withdraw someone else'
);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok(format('select public.withdraw_from_tournament(%L)', (select id from t2)),
  'a player can withdraw themselves');
select is(
  (select status || ':' || champion_id::text from public.tournaments where id = (select id from t2)),
  'completed:22222222-2222-2222-2222-222222222222',
  'the opponent advances when a player withdraws'
);

-- ------------------------------------------------------------ organizer decisions

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.create_tournament((select g from ctx), 'Rain Cup', 4);
reset role;
create temp table t3 as select id from public.tournaments where name = 'Rain Cup';
grant select on t3 to public;
set local role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.register_for_tournament((select id from t3));
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.register_for_tournament((select id from t3));
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.register_for_tournament((select id from t3));
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.register_for_tournament((select id from t3));
select public.start_tournament((select id from t3));

reset role;
create temp table t3_ties as
  select id, position from public.tournament_ties
  where tournament_id = (select id from t3) and round = 1;
grant select on t3_ties to public;
set local role authenticated;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format('select public.decide_tie_by_organizer(%L, null)',
         (select id from t3_ties where position = 0)),
  '42501', 'Only an organizer of this group can manage the tournament',
  'a player cannot award a walkover'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok(
  format('select public.decide_tie_by_organizer(%L, null)',
         (select id from t3_ties where position = 0)),
  'an organizer can put both players out of an unplayed tie'
);
select lives_ok(
  format('select public.decide_tie_by_organizer(%L, %L)',
         (select id from t3_ties where position = 1),
         (select player_a from public.tournament_ties where id = (select id from t3_ties where position = 1))),
  'an organizer can award a walkover'
);
select is(
  (select status || ':' || champion_id::text from public.tournaments where id = (select id from t3)),
  'completed:' || (select player_a::text from public.tournament_ties
                   where id = (select id from t3_ties where position = 1)),
  'a final against an empty slot is a bye, and the tournament completes'
);

-- ------------------------------------------------------------ byes meeting

-- Five entrants play a draw of eight. Seeds 2 and 3 both get byes and meet in
-- the second round; that tie must wait for a match, not be decided unplayed.
reset role;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'fay@example.com', 'x', now(), now(), now(),
        '{}'::jsonb, '{"display_name": "Fay"}'::jsonb);
set local role authenticated;
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select public.join_group_by_code((select code from ctx));

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.create_tournament((select g from ctx), 'Big Cup', 8);
reset role;
create temp table t4 as select id from public.tournaments where name = 'Big Cup';
grant select on t4 to public;
set local role authenticated;
select public.register_for_tournament((select id from t4));
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.register_for_tournament((select id from t4));
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.register_for_tournament((select id from t4));
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.register_for_tournament((select id from t4));
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select public.register_for_tournament((select id from t4));
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.start_tournament((select id from t4));

select is(
  (select count(*)::int from public.tournament_ties
   where tournament_id = (select id from t4) and round = 1 and decided_by = 'bye'),
  3,
  'the top three seeds of five get byes'
);
select is(
  (select coalesce(decided_by, 'open') || ':' || (player_a is not null and player_b is not null)
   from public.tournament_ties
   where tournament_id = (select id from t4) and round = 2 and position = 1),
  'open:true',
  'two bye winners meeting in round two still have to play'
);

select lives_ok(
  format($$ select public.cancel_tournament(%L, 'Courts closed for the season') $$,
         (select id from t1)),
  'an organizer can cancel a tournament in progress'
);

select * from finish();
rollback;
