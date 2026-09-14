-- Regression for the real confirmation boundary and replay exceptions.
-- Owner access only creates users/groups, a past creation-time fixture, tied
-- timestamp fixtures, and performs the explicitly administrative account delete.
begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('11111111-1111-1111-1111-111111111111','rating-life-a@example.test','{"display_name":"Ada"}'),
('22222222-2222-2222-2222-222222222222','rating-life-b@example.test','{"display_name":"Bo"}'),
('33333333-3333-3333-3333-333333333333','rating-life-c@example.test','{"display_name":"Cal"}');
insert into public.groups(id,name,invite_code,created_by) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Rating lifecycle one','RLIFE001','11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Rating lifecycle two','RLIFE002','22222222-2222-2222-2222-222222222222');
insert into public.group_members(group_id,user_id) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111');
create function pg_temp.submit_lifecycle(target_group uuid,opponent uuid,played date) returns uuid language sql as $$
 select (public.submit_match(target_group,opponent,'completed',auth.uid(),'[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]',played)).id;
$$;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select set_config('test.first',pg_temp.submit_lifecycle('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222',current_date-1)::text,true);
select results_eq($$select rating::int,matches_played::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1500,0)$$,'pending score contributes neither rating nor match count');
select results_eq($$select count(*)::int from public.get_rating_history(auth.uid())$$,$$values (0)$$,'pending score creates no rating event');
set local request.jwt.claims='{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok($$select public.confirm_match(current_setting('test.first')::uuid)$$,'opponent confirms first real submission');
create temp table earlier_event as select * from public.get_rating_history(auth.uid());
grant select on earlier_event to authenticated;
select results_eq($$select rating_before::int,rating_after::int from earlier_event$$,$$values (1500,1480)$$,'affected player starts second match with loss from first');
select ok(abs((select sum(delta) from (
 select delta from public.get_rating_history('11111111-1111-1111-1111-111111111111')
 union all select delta from public.get_rating_history('22222222-2222-2222-2222-222222222222')) d))<0.000001,'both participants receive equal opposite deltas');
select set_config('test.rejected',pg_temp.submit_lifecycle('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333',current_date-10)::text,true);
set local request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$select public.reject_match(current_setting('test.rejected')::uuid)$$,'opponent rejects second submission');
select results_eq($$select rating::int,matches_played::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1500,0)$$,'rejected score contributes neither rating nor count');
select results_eq($$select count(*)::int from public.get_rating_history(auth.uid())$$,$$values (0)$$,'rejected score creates no rating event');
set local request.jwt.claims='{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select set_config('test.expired',pg_temp.submit_lifecycle('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333',current_date-10)::text,true);
reset role;
update public.matches set created_at=now()-interval '15 days' where id=current_setting('test.expired')::uuid;
set local role authenticated;
set local request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select results_eq($$select rating::int,matches_played::int from public.get_ratings() where player_id=auth.uid()$$,$$values (1500,0)$$,'expired score contributes neither rating nor count');
select results_eq($$select count(*)::int from public.get_rating_history(auth.uid())$$,$$values (0)$$,'expired score creates no rating event');
set local request.jwt.claims='{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select set_config('test.second',pg_temp.submit_lifecycle('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333',current_date-10)::text,true);
set local request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$select public.confirm_match(current_setting('test.second')::uuid)$$,'opponent confirms real backdated submission');
set local request.jwt.claims='{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select results_eq($$select * from public.get_rating_history(auth.uid()) where match_id=current_setting('test.first')::uuid$$,$$select * from earlier_event$$,'backdated RPC confirmation leaves every field of earlier affected-player event unchanged');
select results_eq($$select rating_before::int from public.get_rating_history(auth.uid()) where match_id=current_setting('test.second')::uuid$$,$$values (1480)$$,'backdated match appends after previous confirmed loss');
select ok(abs((select rating_after from public.get_rating_history(auth.uid()) where match_id=current_setting('test.second')::uuid)-1501.1500225553785)<0.000001,'later event includes unequal-strength expectation');
select ok((select confirmed_at from public.matches where id=current_setting('test.first')::uuid)<(select confirmed_at from public.matches where id=current_setting('test.second')::uuid),'confirmation timestamps increase regardless of played date');
set local request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$select public.void_match(current_setting('test.first')::uuid)$$,'organizer voids earlier event through real RPC');
select results_eq($$select rating_before::int,rating_after::int,delta::int from public.get_rating_history('22222222-2222-2222-2222-222222222222') where match_id=current_setting('test.second')::uuid$$,$$values (1500,1520,20)$$,'void replays later affected-player event from starting rating');
reset role;
delete from auth.users where id='33333333-3333-3333-3333-333333333333';
set local role authenticated;
select results_eq($$select rating::int,matches_played::int from public.get_ratings() where player_id='22222222-2222-2222-2222-222222222222'$$,$$values (1500,0)$$,'account deletion removes matches and recalculates surviving opponent');
select results_eq($$select count(*)::int from public.get_rating_history('22222222-2222-2222-2222-222222222222')$$,$$values (0)$$,'account deletion removes surviving opponent rating events');
-- Deliberately tied legacy timestamps: insert larger id first, prove fold uses
-- id as its deterministic secondary key, not physical insertion order.
reset role;
insert into public.matches(id,group_id,player_a,player_b,winner,submitted_by,outcome,status,played_on,confirmed_at) values
('10000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','completed','confirmed',current_date-1,now()),
('10000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','completed','confirmed',current_date-1,now());
insert into public.match_sets(match_id,set_number,games_a,games_b,complete) values
('10000000-0000-0000-0000-000000000002',1,0,6,true),('10000000-0000-0000-0000-000000000002',2,0,6,true),
('10000000-0000-0000-0000-000000000001',1,6,0,true),('10000000-0000-0000-0000-000000000001',2,6,0,true);
set local role authenticated;
select results_eq($$select match_id,rating_before::int from public.get_rating_history(auth.uid()) order by match_id$$,$$values ('10000000-0000-0000-0000-000000000001'::uuid,1500),('10000000-0000-0000-0000-000000000002'::uuid,1520)$$,'equal confirmation times fold lower id first despite reverse insertion');
select results_eq($$select match_id from public.get_rating_history(auth.uid())$$,$$values ('10000000-0000-0000-0000-000000000002'::uuid),('10000000-0000-0000-0000-000000000001'::uuid)$$,'history exposes deterministic newest-first tie order');
select * from finish();
rollback;
