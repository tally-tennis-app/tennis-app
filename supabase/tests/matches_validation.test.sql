-- Every score goes through the authenticated RPC: dropping any validator branch
-- makes its corresponding literal case fail. Owner privileges are fixtures only.
begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','match-a@example.com','{"display_name":"Ada"}'),
 ('22222222-2222-2222-2222-222222222222','match-b@example.com','{"display_name":"Bo"}'),
 ('33333333-3333-3333-3333-333333333333','match-c@example.com','{"display_name":"Cal"}');
insert into public.groups(id,name,invite_code,created_by) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Match group','MATCH001','11111111-1111-1111-1111-111111111111');
insert into public.group_members(group_id,user_id) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222');
create function pg_temp.score_sql(score jsonb, outcome text default 'completed', winner uuid default '11111111-1111-1111-1111-111111111111', retired uuid default null, played date default current_date, fmt text default 'match')
returns text language sql as $$ select format(
 'select public.submit_match(%L::uuid,%L::uuid,%L,%L::uuid,%L::jsonb,%L::date,%L::uuid,%L)',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222',outcome,winner,score,played,retired,fmt) $$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":2,"games_a":7,"games_b":5,"complete":true}]'), 'straight sets are accepted');
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":7,"complete":true,"tiebreak_a":8,"tiebreak_b":10},{"set_number":2,"games_a":7,"games_b":6,"complete":true,"tiebreak_a":7,"tiebreak_b":5},{"set_number":3,"games_a":6,"games_b":4,"complete":true}]'), 'three sets and legal extended tiebreaks are accepted');
select throws_ok(pg_temp.score_sql(s), '22023', null, reason) from (values
 ('[{"set_number":1,"games_a":6,"games_b":5,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]'::jsonb, '6-5 is not a complete set'),
 ('[{"set_number":1,"games_a":8,"games_b":6,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'advantage sets are rejected'),
 ('[{"set_number":1,"games_a":-1,"games_b":6,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'negative games are rejected'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":true}]', 'one set cannot complete a match'),
 ('[{"set_number":2,"games_a":6,"games_b":0,"complete":true},{"set_number":1,"games_a":6,"games_b":0,"complete":true}]', 'set order must be contiguous in input'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":1,"games_a":6,"games_b":0,"complete":true}]', 'duplicate set numbers are rejected'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true},{"set_number":3,"games_a":0,"games_b":6,"complete":true}]', 'no games after victory'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":2,"games_a":0,"games_b":6,"complete":true},{"set_number":3,"games_a":6,"games_b":0,"complete":true},{"set_number":4,"games_a":6,"games_b":0,"complete":true}]', 'at most three sets'),
 ('[{"set_number":1,"games_a":7,"games_b":6,"complete":true,"tiebreak_a":7},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'tiebreak points must be paired'),
 ('[{"set_number":1,"games_a":7,"games_b":6,"complete":true,"tiebreak_a":7,"tiebreak_b":6},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'tiebreak needs two-point margin'),
 ('[{"set_number":1,"games_a":7,"games_b":6,"complete":true,"tiebreak_a":5,"tiebreak_b":7},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'tiebreak winner matches set winner'),
 ('[{"set_number":1,"games_a":7,"games_b":6,"complete":true,"tiebreak_a":8,"tiebreak_b":2},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'tiebreak cannot continue past victory'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":true,"tiebreak_a":7,"tiebreak_b":1},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'tiebreak points only on 7-6'),
 ('[{"set_number":1,"games_a":6,"games_b":0},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'missing complete is rejected'),
 ('[{"set_number":1,"games_a":6.5,"games_b":0,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'fractional games rejected'),
 ('null', 'null score rejected'), ('{}', 'score must be array')
) cases(s, reason);
select throws_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]','completed','22222222-2222-2222-2222-222222222222'), '22023', null, 'winner must match score');
select lives_ok(pg_temp.score_sql('[]','walkover'), 'walkover has no score');
select throws_ok(pg_temp.score_sql('[{"set_number":1,"games_a":1,"games_b":0,"complete":false}]','walkover'), '22023', null, 'scored walkover rejected');
select throws_ok(pg_temp.score_sql('[]','walkover','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'), '22023', null, 'walkover cannot name retiring player');
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":0,"games_b":6,"complete":true},{"set_number":2,"games_a":2,"games_b":3,"complete":false}]','retired','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'), 'retirement retains partial score and winner need not lead');
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":0,"complete":true}]','retired','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'), 'retirement between sets accepted');
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":6,"complete":false,"tiebreak_a":6,"tiebreak_b":7}]','retired','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'), 'retirement during unfinished tiebreak accepted');
select throws_ok(pg_temp.score_sql(s,'retired','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'), '22023', null, reason) from (values
 ('[]'::jsonb, 'unplayed retirement is walkover'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":false}]', 'a finished set cannot be marked partial'),
 ('[{"set_number":1,"games_a":3,"games_b":2,"complete":false},{"set_number":2,"games_a":2,"games_b":0,"complete":false}]', 'only last set may be partial'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":true},{"set_number":2,"games_a":6,"games_b":0,"complete":true}]', 'retirement after victory rejected'),
 ('[{"set_number":1,"games_a":6,"games_b":6,"complete":false,"tiebreak_a":7,"tiebreak_b":5}]', 'finished tiebreak cannot be marked partial')
) cases(s,reason);
select throws_ok(pg_temp.score_sql('[{"set_number":1,"games_a":1,"games_b":0,"complete":false}]','retired'), '22023', null, 'retirement requires retired_by');
select throws_ok(pg_temp.score_sql('[{"set_number":1,"games_a":1,"games_b":0,"complete":false}]','retired','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111'), '22023', null, 'retired player cannot win');
select throws_ok(pg_temp.score_sql('[]','walkover','11111111-1111-1111-1111-111111111111',null,current_date+1), '22023', null, 'future date rejected');
select throws_ok(pg_temp.score_sql('[]','walkover','11111111-1111-1111-1111-111111111111',null,null), '22023', null, 'null date rejected');
select throws_ok(pg_temp.score_sql('[]','walkover','11111111-1111-1111-1111-111111111111',null,'infinity'), '22023', null, 'infinite date rejected');
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":0,"games_b":0,"complete":false}]','retired','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'), 'retirement before a game completes retains 0-0 partial set');

-- Single set: exactly one score, decided by that set alone.
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":4,"complete":true}]','completed','11111111-1111-1111-1111-111111111111',null,current_date,'set'), 'a single set completes a set format');
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":7,"games_b":6,"complete":true,"tiebreak_a":7,"tiebreak_b":5}]','completed','11111111-1111-1111-1111-111111111111',null,current_date,'set'), 'a single set may be decided by its own 7-6 tiebreak');
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":3,"games_b":2,"complete":false}]','retired','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',current_date,'set'), 'a set format may be retired mid-set');
select throws_ok(pg_temp.score_sql(s,'completed','11111111-1111-1111-1111-111111111111',null,current_date,'set'), '22023', null, reason) from (values
 ('[{"set_number":1,"games_a":6,"games_b":4,"complete":true},{"set_number":2,"games_a":6,"games_b":4,"complete":true}]'::jsonb, 'two sets are not a set format'),
 ('[]', 'a set format needs a score'),
 ('[{"set_number":1,"games_a":4,"games_b":6,"complete":true}]', 'the set winner must win the match'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":8,"tiebreak_target":10}]', 'a set format rejects a standalone tiebreak')
) cases(s, reason);

-- Standalone tiebreak: no games, paired points, and a target of 7 or 10.
select lives_ok(pg_temp.score_sql(s,'completed','11111111-1111-1111-1111-111111111111',null,current_date,'tiebreak'), reason) from (values
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":7,"tiebreak_b":5,"tiebreak_target":7}]'::jsonb, 'a seven point tiebreak is accepted'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":9,"tiebreak_b":7,"tiebreak_target":7}]', 'a seven point tiebreak may run long'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":8,"tiebreak_target":10}]', 'a ten point tiebreak is accepted'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":0,"tiebreak_target":10}]', 'a ten point shutout is accepted'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":12,"tiebreak_b":10,"tiebreak_target":10}]', 'a ten point tiebreak may run long')
) cases(s, reason);
select lives_ok(pg_temp.score_sql('[{"set_number":1,"games_a":0,"games_b":0,"complete":false,"tiebreak_a":5,"tiebreak_b":3,"tiebreak_target":10}]','retired','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',current_date,'tiebreak'), 'a tiebreak may be retired while undecided');
select throws_ok(pg_temp.score_sql(s,'completed','11111111-1111-1111-1111-111111111111',null,current_date,'tiebreak'), '22023', null, reason) from (values
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":9,"tiebreak_target":10}]'::jsonb, 'a tiebreak at the target needs a two point margin'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":11,"tiebreak_b":10,"tiebreak_target":10}]', 'a tiebreak past the target needs exactly two'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":13,"tiebreak_b":10,"tiebreak_target":10}]', 'a tiebreak cannot continue past victory'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":8,"tiebreak_b":6,"tiebreak_target":10}]', 'a ten point tiebreak must reach ten'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":7,"tiebreak_b":6,"tiebreak_target":7}]', 'a seven point tiebreak cannot end 7-6'),
 ('[{"set_number":1,"games_a":6,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":8,"tiebreak_target":10}]', 'a standalone tiebreak records no games'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":8}]', 'a tiebreak format needs a target'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":8,"tiebreak_target":9}]', 'a target must be seven or ten'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":8,"tiebreak_target":10},{"set_number":2,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":10,"tiebreak_b":8,"tiebreak_target":10}]', 'a tiebreak format records one score'),
 ('[{"set_number":1,"games_a":0,"games_b":0,"complete":true,"tiebreak_a":8,"tiebreak_b":10,"tiebreak_target":10}]', 'the points winner must win the match')
) cases(s, reason);
select throws_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":4,"complete":true},{"set_number":2,"games_a":6,"games_b":4,"complete":true}]','completed','11111111-1111-1111-1111-111111111111',null,current_date,'doubles'), '22023', null, 'an unknown format is rejected');
select throws_ok(pg_temp.score_sql('[{"set_number":1,"games_a":6,"games_b":4,"complete":true,"tiebreak_target":10},{"set_number":2,"games_a":6,"games_b":4,"complete":true}]'), '22023', null, 'a match format rejects a tiebreak target');
select lives_ok(pg_temp.score_sql('[]','walkover','11111111-1111-1111-1111-111111111111',null,current_date,'tiebreak'), 'a short format may still be a walkover');
select * from finish();
rollback;
