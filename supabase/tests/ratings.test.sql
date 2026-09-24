begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('11111111-1111-1111-1111-111111111111','rating-a@example.test','{"display_name":"Ada"}'),
('22222222-2222-2222-2222-222222222222','rating-b@example.test','{"display_name":"Bo"}'),
('33333333-3333-3333-3333-333333333333','rating-c@example.test','{"display_name":"Cal"}'),
('44444444-4444-4444-4444-444444444444','rating-d@example.test','{"display_name":"Dan"}');
insert into public.groups(id,name,invite_code,created_by) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Ratings one','RATE001','11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Ratings two','RATE002','22222222-2222-2222-2222-222222222222');
insert into public.group_members(group_id,user_id) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333');
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$select * from public.get_ratings()$$,'global ratings callable by user');
select results_eq($$select display_name,rating::int from public.get_ratings() order by display_name$$,$$values ('Ada'::text,1500),('Bo'::text,1500)$$,'only self and shared-group profiles visible, initially 1500');
select throws_ok($$select * from public.get_ratings('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,'42501',null,'cannot enumerate another group');
reset role;
insert into public.matches(id,group_id,player_a,player_b,winner,submitted_by,outcome,status,played_on,confirmed_at) values
('10000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','completed','confirmed',current_date-5,'2026-09-01T12:00:00Z');
insert into public.match_sets(match_id,set_number,games_a,games_b,complete) values
('10000000-0000-0000-0000-000000000001',1,6,0,true),('10000000-0000-0000-0000-000000000001',2,6,0,true);
set local role authenticated;
select results_eq($$select rating::int,matches_played::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1520,1)$$,'double bagel gives 20 points at equal starting strength');
select results_eq($$select rating_before::int,rating_after::int,delta::int from public.get_rating_history(auth.uid())$$,$$values (1500,1520,20)$$,'history exposes before after and delta');
reset role;
-- Later confirmation of an earlier-played result must append, never rewrite.
insert into public.matches(id,group_id,player_a,player_b,winner,submitted_by,outcome,status,played_on,confirmed_at) values
('10000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','completed','confirmed',current_date-10,'2026-09-02T12:00:00Z');
insert into public.match_sets(match_id,set_number,games_a,games_b,complete) values
('10000000-0000-0000-0000-000000000002',1,6,0,true),('10000000-0000-0000-0000-000000000002',2,6,0,true);
set local role authenticated;
select results_eq($$select rating_before::int,rating_after::int,delta::int from public.get_rating_history(auth.uid())$$,$$values (1500,1520,20)$$,'backdated later confirmation leaves prior history unchanged');
select results_eq($$select count(*)::int from public.get_rating_history('22222222-2222-2222-2222-222222222222')$$,$$values (1)$$,'global history hides matches in unrelated groups');
select ok(abs((select rating from public.get_ratings() where display_name='Bo')-1501.1500225553785)<0.000001,'global rating incorporates hidden groups using unequal-strength expected score');
select throws_ok($$select * from public.get_rating_history('33333333-3333-3333-3333-333333333333')$$,'42501',null,'unrelated player history denied');
set local request.jwt.claims='{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select results_eq($$select rating::int from public.get_ratings('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') where player_id=auth.uid()$$,$$values (1520)$$,'group rating uses the same fold with group filter');
select results_eq($$select count(*)::int from public.get_rating_history(auth.uid())$$,$$values (2)$$,'player sees both own shared-group histories');
reset role;
-- Vary the first match only; second group does not affect Ada.
update public.matches set voided_at=now(),voided_by=player_a where id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select results_eq($$select rating::int,matches_played::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1500,0)$$,'voided match drops from fold');
select results_eq($$select count(*)::int from public.get_rating_history(auth.uid())$$,$$values (0)$$,'voided match drops from history');
reset role;
update public.matches set voided_at=null,voided_by=null,outcome='walkover' where id='10000000-0000-0000-0000-000000000001';
delete from public.match_sets where match_id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
select results_eq($$select rating::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1500)$$,'walkover skipped');
reset role;
update public.matches set outcome='retired',retired_by=player_b where id='10000000-0000-0000-0000-000000000001';
insert into public.match_sets(match_id,set_number,games_a,games_b,complete) values('10000000-0000-0000-0000-000000000001',1,4,0,false);
set local role authenticated;
select results_eq($$select rating::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1520)$$,'retirement rates games actually played');
reset role;
update public.match_sets set games_a=0 where match_id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
select results_eq($$select rating::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1516)$$,'zero-game retirement uses neutral margin');
reset role;
update public.matches set outcome='completed',retired_by=null where id='10000000-0000-0000-0000-000000000001';
delete from public.match_sets where match_id='10000000-0000-0000-0000-000000000001';
insert into public.match_sets(match_id,set_number,games_a,games_b,complete) values
('10000000-0000-0000-0000-000000000001',1,6,4,true),('10000000-0000-0000-0000-000000000001',2,0,6,true),('10000000-0000-0000-0000-000000000001',3,6,4,true);
set local role authenticated;
select results_eq($$select rating::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1516)$$,'three-set winner with fewer games clamps multiplier to1.0');
reset role;
-- Short formats weight K: a set is half a match, a tiebreak half a set. The
-- double bagel above is the reference at 20 points.
update public.matches set format='set' where id='10000000-0000-0000-0000-000000000001';
delete from public.match_sets where match_id='10000000-0000-0000-0000-000000000001';
insert into public.match_sets(match_id,set_number,games_a,games_b,complete) values
('10000000-0000-0000-0000-000000000001',1,6,0,true);
set local role authenticated;
select results_eq($$select rating::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1510)$$,'a single set moves half as far as a match');
reset role;
update public.matches set format='tiebreak' where id='10000000-0000-0000-0000-000000000001';
delete from public.match_sets where match_id='10000000-0000-0000-0000-000000000001';
insert into public.match_sets(match_id,set_number,games_a,games_b,complete,tiebreak_a,tiebreak_b,tiebreak_target) values
('10000000-0000-0000-0000-000000000001',1,0,0,true,10,0,10);
set local role authenticated;
select results_eq($$select rating::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1505)$$,'a tiebreak moves half as far as a set');
reset role;
update public.match_sets set tiebreak_b=8 where match_id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
-- A tiebreak records no games. Reading the margin from games would leave the
-- multiplier neutral and land on exactly 1504; the points share lifts it.
select ok((select rating from public.get_ratings() where player_id=auth.uid())>1504.1,'a tiebreak margin comes from points, not games');
reset role;
update public.matches set format='match' where id='10000000-0000-0000-0000-000000000001';
delete from public.match_sets where match_id='10000000-0000-0000-0000-000000000001';
insert into public.match_sets(match_id,set_number,games_a,games_b,complete) values
('10000000-0000-0000-0000-000000000001',1,6,0,true),('10000000-0000-0000-0000-000000000001',2,6,0,true);
update public.group_members set left_at=now() where user_id='22222222-2222-2222-2222-222222222222' and group_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
select results_eq($$select active from public.get_ratings('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where display_name='Bo'$$,$$values (false)$$,'departed player retained as inactive');
set local request.jwt.claims='{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select results_eq($$select display_name,rating::int from public.get_ratings()$$,$$values ('Dan'::text,1500)$$,'new player sees own starting rating without groups');
select throws_ok($$select * from private.rating_events(null)$$,'42501',null,'internal fold inaccessible directly');
reset role;
set local role anon;
select throws_ok($$select * from public.get_ratings()$$,'42501',null,'anonymous ratings denied');
select throws_ok($$select * from public.get_rating_history('11111111-1111-1111-1111-111111111111')$$,'42501',null,'anonymous history denied');
select * from finish();
rollback;
