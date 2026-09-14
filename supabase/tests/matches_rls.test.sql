begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','match-a@example.com','{"display_name":"Ada"}'),
 ('22222222-2222-2222-2222-222222222222','match-b@example.com','{"display_name":"Bo"}'),
 ('33333333-3333-3333-3333-333333333333','match-c@example.com','{"display_name":"Cal"}'),
 ('44444444-4444-4444-4444-444444444444','match-d@example.com','{"display_name":"Dee"}');
insert into public.groups(id,name,invite_code,created_by) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Match group','MATCH001','11111111-1111-1111-1111-111111111111'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Other group','MATCH002','44444444-4444-4444-4444-444444444444');
insert into public.group_members(group_id,user_id) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333');
-- Helpers are SECURITY INVOKER; they do not elevate assertions.
create function pg_temp.submit_sql(opponent uuid default '22222222-2222-2222-2222-222222222222') returns text language sql as $$
 select format('select set_config(''test.match'', (public.submit_match(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'',%L,''completed'',''11111111-1111-1111-1111-111111111111'',''[{"set_number":1,"games_a":6,"games_b":2,"complete":true},{"set_number":2,"games_a":6,"games_b":4,"complete":true}]'')).id::text,true)',opponent)
$$;
create function pg_temp.act_sql(action text) returns text language sql as $$
 select format('select public.%I(nullif(current_setting(''test.match'',true),'''')::uuid)',action)
$$;
create function pg_temp.edit_sql(score jsonb default '[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":2,"games_a":7,"games_b":5,"complete":true}]') returns text language sql as $$
 select format('select public.edit_match(nullif(current_setting(''test.match'',true),'''')::uuid,''completed'',''11111111-1111-1111-1111-111111111111'',%L::jsonb,current_date-2)',score)
$$;
set local role anon;
select throws_ok(pg_temp.submit_sql(), '42501', null, 'anonymous cannot submit');
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select throws_ok(pg_temp.submit_sql(), '42501', null, 'outsider cannot submit into another group');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok(pg_temp.submit_sql('11111111-1111-1111-1111-111111111111'), '22023', null, 'cannot play yourself');
select throws_ok(pg_temp.submit_sql('44444444-4444-4444-4444-444444444444'), '42501', null, 'cannot submit cross-group opponent');
select lives_ok(pg_temp.submit_sql(), 'participant submits a pending match atomically');
select results_eq('select status from public.matches', $$values ('pending'::text)$$, 'submitted match is pending');
select results_eq('select sum(wins)::int from public.group_standings', $$values (0)$$, 'pending match does not count');
select throws_ok(pg_temp.act_sql('confirm_match'), '42501', null, 'submitter cannot confirm their own match');
select throws_ok(pg_temp.act_sql('reject_match'), '42501', null, 'submitter cannot reject own match');
select throws_ok($$insert into public.matches(group_id,player_a,player_b,played_on,outcome,winner,submitted_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',current_date,'walkover','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111')$$, '42501', null, 'direct match insertion denied');
select throws_ok($$insert into public.match_sets values (current_setting('test.match')::uuid,3,6,0,null,null,true)$$, '42501', null, 'direct set insertion denied');
select throws_ok($$update public.matches set status='confirmed'$$, '42501', null, 'direct confirmation denied');
select throws_ok($$update public.match_sets set games_a=0$$, '42501', null, 'direct set update denied');
select throws_ok($$delete from public.matches$$, '42501', null, 'direct match delete denied');
select throws_ok($$delete from public.match_sets$$, '42501', null, 'direct set delete denied');
select lives_ok(pg_temp.edit_sql(), 'submitter replaces pending score');
select results_eq('select sum(games_a)::int from public.match_sets', $$values (13)$$, 'replacement removes old sets');
select results_eq('select played_on from public.matches', $$values (current_date-2)$$, 'pending edit can change date');
select throws_ok(pg_temp.edit_sql('[{"set_number":1,"games_a":6,"games_b":5,"complete":true}]'), '22023', null, 'bad replacement rejected');
select results_eq('select sum(games_a)::int from public.match_sets', $$values (13)$$, 'failed replacement leaves original intact');
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok(pg_temp.act_sql('confirm_match'), '42501', null, 'nonparticipant member cannot confirm');
select throws_ok(pg_temp.act_sql('reject_match'), '42501', null, 'nonparticipant cannot reject');
select throws_ok(pg_temp.act_sql('withdraw_match'), '42501', null, 'nonparticipant cannot withdraw');
select throws_ok(pg_temp.edit_sql(), '42501', null, 'nonparticipant cannot edit');
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select results_eq('select count(*)::int from public.matches', $$values (0)$$, 'unrelated member sees no matches');
select results_eq('select count(*)::int from public.match_sets', $$values (0)$$, 'unrelated member sees no sets');
select results_eq('select count(*)::int from public.group_standings', $$values (1)$$, 'invoker standings expose own group only');
select throws_ok(pg_temp.act_sql('confirm_match'), '42501', null, 'outsider cannot confirm known id');
select throws_ok($$select public.confirm_match('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')$$, '42501', 'Match is not available', 'unknown id and unauthorized id share error');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok(pg_temp.edit_sql(), '42501', null, 'opponent cannot edit submission');
select throws_ok(pg_temp.act_sql('withdraw_match'), '42501', null, 'opponent cannot withdraw');
select lives_ok(pg_temp.act_sql('confirm_match'), 'opponent confirms');
select results_eq('select status,confirmed_at is not null from public.matches', $$values ('confirmed'::text,true)$$, 'confirmation timestamp recorded');
select results_eq($$select wins::int,losses::int,games_won::int,games_lost::int from public.group_standings where user_id='11111111-1111-1111-1111-111111111111'$$, $$values (1,0,13,5)$$, 'confirmed score moves winners standings');
select results_eq($$select wins::int,losses::int,games_won::int,games_lost::int from public.group_standings where user_id='22222222-2222-2222-2222-222222222222'$$, $$values (0,1,5,13)$$, 'confirmed score moves opponent standings');
select throws_ok(pg_temp.act_sql('confirm_match'), '22023', null, 'cannot confirm twice');
select throws_ok(pg_temp.act_sql('reject_match'), '22023', null, 'cannot reject confirmed match');
select throws_ok(pg_temp.act_sql('void_match'), '42501', null, 'player cannot void');
select throws_ok($$update public.matches set played_on=current_date$$, '42501', null, 'confirmed date protected from direct SQL');
select throws_ok($$delete from public.matches$$, '42501', null, 'confirmed row protected from direct SQL');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok(pg_temp.edit_sql(), '22023', null, 'submitter cannot edit confirmed match');
select throws_ok(pg_temp.act_sql('withdraw_match'), '22023', null, 'submitter cannot withdraw confirmed match');
select lives_ok($$select public.remove_group_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222')$$, 'remove opponent after confirmation');
select results_eq($$select active,losses::int from public.group_standings where user_id='22222222-2222-2222-2222-222222222222'$$, $$values (false,1)$$, 'departed player retains inactive standings');
select throws_ok(pg_temp.submit_sql(), '42501', null, 'inactive opponent cannot receive new match');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select results_eq('select count(*)::int from public.matches', $$values (0)$$, 'departed participant loses history access');
select results_eq('select count(*)::int from public.match_sets', $$values (0)$$, 'departed participant loses set access');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(pg_temp.act_sql('void_match'), 'organizer voids confirmed score');
select results_eq('select status,voided_at is not null,played_on from public.matches', $$values ('confirmed'::text,true,current_date-2)$$, 'void preserves status and original date');
select results_eq('select sum(games_a)::int from public.match_sets', $$values (13)$$, 'void preserves score');
select results_eq('select sum(wins)::int from public.group_standings', $$values (0)$$, 'void excludes standings');
select throws_ok(pg_temp.act_sql('void_match'), '22023', null, 'repeat void refused');
select lives_ok($$select public.restore_group_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222')$$, 'restore opponent');
select lives_ok(pg_temp.submit_sql(), 'new pending match for rejection');
select throws_ok(pg_temp.act_sql('void_match'), '22023', null, 'organizer cannot void pending match');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok(pg_temp.act_sql('reject_match'), 'opponent rejects');
select results_eq($$select status from public.matches where id=current_setting('test.match')::uuid$$, $$values ('rejected'::text)$$, 'rejected remains history');
select throws_ok(pg_temp.act_sql('confirm_match'), '22023', null, 'rejected cannot later confirm');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(pg_temp.submit_sql(), 'new pending match for withdrawal');
select lives_ok(pg_temp.act_sql('withdraw_match'), 'submitter withdraws pending match');
select results_eq($$select count(*)::int from public.match_sets where match_id=current_setting('test.match')::uuid$$, $$values (0)$$, 'withdraw cascades sets');
select lives_ok(pg_temp.submit_sql(), 'new pending match for expiry');
-- Owner fixture backdates creation; user RPC cannot change it.
reset role;
select lives_ok($$update public.matches set created_at=now()-interval '14 days 1 second' where id=current_setting('test.match')::uuid$$, 'backdate expiry fixture');
set local role authenticated;
select throws_ok(pg_temp.edit_sql(), '22023', null, 'expired match cannot edit');
select throws_ok(pg_temp.act_sql('withdraw_match'), '22023', null, 'expired match cannot withdraw');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok(pg_temp.act_sql('confirm_match'), '22023', null, 'expired match cannot confirm');
select throws_ok(pg_temp.act_sql('reject_match'), '22023', null, 'expired match cannot reject');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$select set_config('test.match',(public.submit_match('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','walkover','11111111-1111-1111-1111-111111111111','[]')).id::text,true)$$, 'submit walkover');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok(pg_temp.act_sql('confirm_match'), 'confirm walkover');
select results_eq($$select wins::int,games_won::int from public.group_standings where user_id='11111111-1111-1111-1111-111111111111'$$, $$values (1,0)$$, 'walkovers count wins without games');
-- Administrative auth deletion is the explicit immutable-history exception.
reset role;
select lives_ok($$delete from auth.users where id='22222222-2222-2222-2222-222222222222'$$, 'account deletion cascades confirmed and voided history');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select results_eq('select count(*)::int from public.matches', $$values (0)$$, 'deleted account matches gone');
select results_eq('select count(*)::int from public.match_sets', $$values (0)$$, 'deleted account sets gone');
select * from finish();
rollback;
