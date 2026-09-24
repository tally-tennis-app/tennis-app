-- Short formats: a single set and a standalone tiebreak are whole results.
--
-- A set is worth half a match and a tiebreak half a set, applied as a weight on
-- K inside the derived fold. Nothing about immutability or confirm-order
-- changes; see docs/decisions/0005-short-formats-and-rating-weights.md.
--
-- Additive and backward compatible: every new column has a default and every
-- widened function keeps a default for its new argument, so the application
-- already deployed keeps submitting best-of-three matches unchanged.

alter table public.matches
  add column format text not null default 'match'
    check (format in ('match', 'set', 'tiebreak'));
comment on column public.matches.format is
  'match = best of three sets, set = one set, tiebreak = one standalone tiebreak. Weights the rating fold.';

-- A standalone tiebreak records no games, so its points live in the existing
-- tiebreak columns and this target is what marks the row as one. Null target
-- means an ordinary set, which keeps every existing row and rule untouched.
alter table public.match_sets
  add column tiebreak_target smallint
    check (tiebreak_target is null or tiebreak_target in (7, 10));
comment on column public.match_sets.tiebreak_target is
  'Points needed to win a standalone tiebreak, 7 or 10. Null on an ordinary set, including a 7-6 set tiebreak.';

create function public.is_legal_score_row(a integer, b integer, ta integer, tb integer,
  done boolean, target integer)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  high_points integer;
  low_points integer;
begin
  if target is null then return public.is_legal_match_set(a, b, ta, tb, done); end if;
  -- A standalone tiebreak has no games and always carries paired points.
  if a is null or b is null or done is null or a <> 0 or b <> 0 then return false; end if;
  if ta is null or tb is null or ta < 0 or tb < 0 then return false; end if;
  high_points := greatest(ta, tb); low_points := least(ta, tb);
  if done then
    return (high_points = target and low_points <= target - 2)
        or (high_points > target and high_points::bigint - low_points = 2);
  end if;
  -- Retiring inside a tiebreak: the points must not already decide it.
  return high_points < target or high_points::bigint - low_points < 2;
end;
$$;
revoke all on function
  public.is_legal_score_row(integer, integer, integer, integer, boolean, integer)
  from public, anon, authenticated;

alter table public.match_sets
  drop constraint match_sets_legal_score,
  add constraint match_sets_legal_score
    check (public.is_legal_score_row(games_a, games_b, tiebreak_a, tiebreak_b,
      complete, tiebreak_target));

-- --------------------------------------------------------------------------
-- Composite validation
-- --------------------------------------------------------------------------
-- Dropped and recreated rather than overloaded: this is internal, revoked from
-- every API role, and has exactly three callers, all recreated below.
drop function public.validate_match_score(uuid, uuid, text, uuid, jsonb, date, uuid);

create function public.validate_match_score(a uuid, b uuid, match_outcome text,
  match_winner uuid, sets jsonb, match_played_on date, match_retired_by uuid,
  match_format text default 'match')
returns void language plpgsql set search_path = '' as $$
declare
 s jsonb; n integer; i integer := 0; aw integer := 0; bw integer := 0;
 ga integer; gb integer; ta integer; tb integer; done boolean; target integer;
 decided boolean;
begin
 if a is null or b is null or a=b or match_winner is null or match_winner not in (a,b)
   or match_outcome is null or match_outcome not in ('completed','retired','walkover')
   or match_format is null or match_format not in ('match','set','tiebreak')
   or match_played_on is null or not isfinite(match_played_on) or match_played_on>current_date
   or sets is null or jsonb_typeof(sets)<>'array' then
   raise exception 'Invalid match details' using errcode='22023';
 end if;
 n := jsonb_array_length(sets);
 if match_outcome='walkover' then
   if n<>0 or match_retired_by is not null then raise exception 'Walkovers cannot have a score or retiring player' using errcode='22023'; end if;
   return;
 end if;
 -- A short format records exactly one score; a match records two or three.
 if (match_format='match' and (n not between 1 and 3 or (match_outcome='completed' and n<2)))
   or (match_format<>'match' and n<>1) then
   raise exception 'Invalid match outcome' using errcode='22023';
 end if;
 if (match_outcome='completed' and match_retired_by is not null)
   or (match_outcome='retired' and (match_retired_by is null or match_retired_by not in (a,b) or match_retired_by=match_winner)) then
   raise exception 'Invalid match outcome' using errcode='22023';
 end if;
 for s in select value from jsonb_array_elements(sets) loop
   i := i+1;
   -- Reject coercion of decimals, strings, missing fields and malformed points.
   if jsonb_typeof(s)<>'object'
     or not coalesce((s->>'set_number') ~ '^[0-9]+$' and jsonb_typeof(s->'set_number')='number',false)
     or not coalesce((s->>'games_a') ~ '^[0-9]+$' and jsonb_typeof(s->'games_a')='number',false)
     or not coalesce((s->>'games_b') ~ '^[0-9]+$' and jsonb_typeof(s->'games_b')='number',false)
     or not coalesce(jsonb_typeof(s->'complete')='boolean',false)
     or (s->'tiebreak_a' is not null and s->'tiebreak_a'<>'null'::jsonb and not coalesce((s->>'tiebreak_a') ~ '^[0-9]+$' and jsonb_typeof(s->'tiebreak_a')='number',false))
     or (s->'tiebreak_b' is not null and s->'tiebreak_b'<>'null'::jsonb and not coalesce((s->>'tiebreak_b') ~ '^[0-9]+$' and jsonb_typeof(s->'tiebreak_b')='number',false))
     or (s->'tiebreak_target' is not null and s->'tiebreak_target'<>'null'::jsonb and not coalesce((s->>'tiebreak_target') ~ '^[0-9]+$' and jsonb_typeof(s->'tiebreak_target')='number',false)) then
     raise exception 'Invalid set fields' using errcode='22023';
   end if;
   ga := (s->>'games_a')::integer; gb := (s->>'games_b')::integer;
   ta := (s->>'tiebreak_a')::integer; tb := (s->>'tiebreak_b')::integer;
   target := (s->>'tiebreak_target')::integer;
   done := (s->>'complete')::boolean;
   -- Only a tiebreak format carries a target, and it always carries one. The
   -- range is checked here so an illegal target is a validation error rather
   -- than a raw column constraint violation.
   if (match_format='tiebreak') <> (target is not null)
     or (target is not null and target not in (7,10)) then
     raise exception 'Invalid set score or order' using errcode='22023';
   end if;
   if (s->>'set_number')::integer<>i or aw=2 or bw=2
     or not public.is_legal_score_row(ga,gb,ta,tb,done,target)
     or (not done and (match_outcome<>'retired' or i<>n)) then
     raise exception 'Invalid set score or order' using errcode='22023';
   end if;
   if done then
     if (target is null and ga>gb) or (target is not null and ta>tb) then aw:=aw+1; else bw:=bw+1; end if;
   end if;
 end loop;
 -- A match needs two sets; a set or tiebreak is decided by its single score.
 decided := case when match_format='match' then aw=2 or bw=2 else aw+bw=1 end;
 if (match_outcome='completed' and not (decided and ((aw>bw and match_winner=a) or (bw>aw and match_winner=b))))
   or (match_outcome='retired' and decided) then
   raise exception 'Score does not match outcome or winner' using errcode='22023';
 end if;
exception when numeric_value_out_of_range or invalid_text_representation then
 raise exception 'Invalid numeric score' using errcode='22023';
end;
$$;
revoke all on function public.validate_match_score(uuid,uuid,text,uuid,jsonb,date,uuid,text) from public,anon,authenticated;

create or replace function public.replace_match_sets(target_match uuid,sets jsonb)
returns void language sql set search_path = '' as $$
 delete from public.match_sets where match_id=target_match;
 insert into public.match_sets(match_id,set_number,games_a,games_b,tiebreak_a,tiebreak_b,complete,tiebreak_target)
 select target_match,(s->>'set_number')::integer,(s->>'games_a')::integer,(s->>'games_b')::integer,
   (s->>'tiebreak_a')::integer,(s->>'tiebreak_b')::integer,(s->>'complete')::boolean,
   (s->>'tiebreak_target')::integer
 from jsonb_array_elements(sets) s;
$$;
revoke all on function public.replace_match_sets(uuid,jsonb) from public,anon,authenticated;

-- --------------------------------------------------------------------------
-- Write RPCs
-- --------------------------------------------------------------------------
-- Each keeps one function with a defaulted new argument, so a caller that
-- names only the original arguments still resolves. Dropping and recreating in
-- this transaction leaves no window where the name is missing.
drop function public.submit_match(uuid,uuid,text,uuid,jsonb,date,uuid);

create function public.submit_match(target_group uuid,opponent uuid,match_outcome text,match_winner uuid,sets jsonb,match_played_on date default current_date,match_retired_by uuid default null,match_format text default 'match')
returns public.matches language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.matches;
begin
 perform 1 from public.groups where id=target_group for update;
 if actor is null or not public.is_group_member(target_group) then
   raise exception 'Match is not available' using errcode='42501';
 end if;
 if actor=opponent then raise exception 'Players must be different' using errcode='22023'; end if;
 if not exists(select 1 from public.group_members where group_id=target_group and user_id=opponent and left_at is null) then
   raise exception 'Both players must be active group members' using errcode='42501';
 end if;
 perform public.validate_match_score(actor,opponent,match_outcome,match_winner,sets,match_played_on,match_retired_by,match_format);
 insert into public.matches(group_id,player_a,player_b,played_on,outcome,retired_by,winner,submitted_by,format)
 values(target_group,actor,opponent,match_played_on,match_outcome,match_retired_by,match_winner,actor,match_format) returning * into result;
 perform public.replace_match_sets(result.id,sets);
 return result;
end;
$$;

drop function public.edit_match(uuid,text,uuid,jsonb,date,uuid);

-- match_format defaults to null, meaning "leave the format alone", so a caller
-- that names only the original arguments cannot silently rewrite a short format
-- into a best-of-three.
create function public.edit_match(target_match uuid,match_outcome text,match_winner uuid,sets jsonb,match_played_on date default current_date,match_retired_by uuid default null,match_format text default null)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 result := public.lock_member_match(target_match);
 match_format := coalesce(match_format,result.format);
 if auth.uid()<>result.submitted_by then raise exception 'Only the submitter can edit' using errcode='42501'; end if;
 if result.status<>'pending' or result.created_at<now()-interval '14 days' then raise exception 'Match is not pending or has expired' using errcode='22023'; end if;
 if not exists(select 1 from public.group_members where group_id=result.group_id and user_id=result.player_a and left_at is null)
    or not exists(select 1 from public.group_members where group_id=result.group_id and user_id=result.player_b and left_at is null) then
   raise exception 'Both players must be active group members' using errcode='42501';
 end if;
 -- A tie's format belongs to its tournament, so an edit may not change it.
 if result.tournament_tie_id is not null and match_format<>result.format then
   raise exception 'A tournament sets the format for its ties' using errcode='22023';
 end if;
 perform public.validate_match_score(result.player_a,result.player_b,match_outcome,match_winner,sets,match_played_on,match_retired_by,match_format);
 update public.matches set outcome=match_outcome,winner=match_winner,played_on=match_played_on,retired_by=match_retired_by,format=match_format
 where id=target_match returning * into result;
 perform public.replace_match_sets(target_match,sets);
 return result;
end;
$$;

revoke all on function public.submit_match(uuid,uuid,text,uuid,jsonb,date,uuid,text),public.edit_match(uuid,text,uuid,jsonb,date,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_match(uuid,uuid,text,uuid,jsonb,date,uuid,text),public.edit_match(uuid,text,uuid,jsonb,date,uuid,text) to authenticated,service_role;

-- --------------------------------------------------------------------------
-- Tournaments choose one format for the whole draw
-- --------------------------------------------------------------------------
alter table public.tournaments
  add column format text not null default 'match'
    check (format in ('match', 'set', 'tiebreak'));
comment on column public.tournaments.format is
  'The format every tie in this draw is played in. Fixed at creation.';

drop function public.create_tournament(uuid, text, integer, text, integer);

create function public.create_tournament(
  target_group uuid,
  tournament_name text,
  cap integer,
  seeding_method text default 'rating',
  days_per_round integer default 7,
  tournament_format text default 'match'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_tournament uuid;
begin
  if not public.is_group_organizer(target_group) then
    raise exception 'Only an organizer of this group can create a tournament'
      using errcode = '42501';
  end if;

  if tournament_name is null or char_length(trim(tournament_name)) not between 1 and 80 then
    raise exception 'Give the tournament a name of up to 80 characters' using errcode = '22023';
  end if;

  if cap is null or cap not in (4, 8, 16, 32) then
    raise exception 'The entrant limit must be 4, 8, 16, or 32' using errcode = '22023';
  end if;

  if seeding_method not in ('rating', 'random') then
    raise exception 'Choose rating or random seeding' using errcode = '22023';
  end if;

  if days_per_round is null or days_per_round not between 1 and 60 then
    raise exception 'Each round needs between 1 and 60 days' using errcode = '22023';
  end if;

  if tournament_format is null or tournament_format not in ('match', 'set', 'tiebreak') then
    raise exception 'Choose a match, single set, or tiebreak format' using errcode = '22023';
  end if;

  insert into public.tournaments
    (group_id, name, created_by, entrant_cap, seeding, round_days, format)
  values
    (target_group, trim(tournament_name), (select auth.uid()), cap, seeding_method,
     days_per_round, tournament_format)
  returning id into new_tournament;

  perform public.log_tournament_event(new_tournament, 'created', 'Registration opened');
  return new_tournament;
end;
$$;

revoke execute on function public.create_tournament(uuid, text, integer, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.create_tournament(uuid, text, integer, text, integer, text)
  to authenticated, service_role;

-- The tie's format comes from the tournament, never from the submitter.
create or replace function public.submit_tournament_match(
  target_tie uuid,
  match_outcome text,
  match_winner uuid,
  sets jsonb,
  match_played_on date default current_date,
  match_retired_by uuid default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  tie public.tournament_ties;
  t public.tournaments;
  existing public.matches;
  opponent uuid;
  result public.matches;
begin
  select * into tie from public.tournament_ties where id = target_tie;
  select * into t from public.tournaments where id = tie.tournament_id;

  -- Same lock order as the match functions: group, then the rows below it.
  perform 1 from public.groups where id = t.group_id for update;
  select * into tie from public.tournament_ties where id = target_tie for update;

  if actor is null or not found or actor not in (tie.player_a, tie.player_b)
     or not public.is_group_member(t.group_id) then
    raise exception 'Only the two players in this tie can submit its result'
      using errcode = '42501';
  end if;

  if t.status <> 'in_progress' or tie.decided_at is not null then
    raise exception 'This tie is no longer open' using errcode = '23514';
  end if;

  opponent := case when actor = tie.player_a then tie.player_b else tie.player_a end;
  if opponent is null or public.is_withdrawn(t.id, opponent) or public.is_withdrawn(t.id, actor) then
    raise exception 'This tie does not have two players yet' using errcode = '23514';
  end if;

  if not exists (select 1 from public.group_members
                 where group_id = t.group_id and user_id = opponent and left_at is null) then
    raise exception 'Both players must be active group members' using errcode = '42501';
  end if;

  if tie.match_id is not null then
    select * into existing from public.matches where id = tie.match_id;
    -- An expired or rejected submission frees the tie; a pending one is live.
    if existing.status = 'rejected'
       or (existing.status = 'pending' and existing.created_at < now() - interval '14 days') then
      update public.tournament_ties set match_id = null where id = tie.id;
    else
      raise exception 'A result for this tie is already waiting. Confirm, reject, or edit it instead'
        using errcode = '23514';
    end if;
  end if;

  perform public.validate_match_score(actor, opponent, match_outcome, match_winner,
    sets, match_played_on, match_retired_by, t.format);

  insert into public.matches
    (group_id, player_a, player_b, played_on, outcome, retired_by, winner,
     submitted_by, tournament_tie_id, format)
  values
    (t.group_id, actor, opponent, match_played_on, match_outcome, match_retired_by,
     match_winner, actor, tie.id, t.format)
  returning * into result;

  perform public.replace_match_sets(result.id, sets);
  update public.tournament_ties set match_id = result.id where id = tie.id;
  return result;
end;
$$;

-- --------------------------------------------------------------------------
-- Rating weight
-- --------------------------------------------------------------------------
-- A set is half a match and a tiebreak half a set. Kept beside K and MOV_M as
-- a named calibration knob rather than a literal in the fold.
create function private.format_weight(match_format text)
returns double precision language sql immutable set search_path = '' as $$
 select case match_format when 'set' then 0.5 when 'tiebreak' then 0.25 else 1.0 end::double precision
$$;
revoke all on function private.format_weight(text) from public,anon,authenticated;

create or replace function private.rating_events(p_group_id uuid default null)
returns table(match_id uuid,group_id uuid,player_id uuid,confirmed_at timestamptz,
 rating_before double precision,rating_after double precision,delta double precision,matches_played bigint)
language plpgsql stable set search_path='' as $$
declare
 parameters record;
 ratings jsonb := '{}'::jsonb; counts jsonb := '{}'::jsonb;
 m record; ra double precision; rb double precision; expected double precision;
 share double precision; multiplier double precision; change double precision;
 won double precision; lost double precision;
 ca bigint; cb bigint;
begin
 select * into parameters from private.rating_parameters();
 for m in
  select x.*,coalesce(s.ga,0) ga,coalesce(s.gb,0) gb,coalesce(s.pa,0) pa,coalesce(s.pb,0) pb
  from public.matches x
  left join lateral(select sum(ms.games_a) ga,sum(ms.games_b) gb,
    sum(ms.tiebreak_a) pa,sum(ms.tiebreak_b) pb
    from public.match_sets ms where ms.match_id=x.id) s on true
  where x.status='confirmed' and x.voided_at is null and x.outcome<>'walkover'
    and (p_group_id is null or x.group_id=p_group_id)
  order by x.confirmed_at,x.id
 loop
  ra:=coalesce((ratings->>m.player_a::text)::double precision,parameters.starting_rating);
  rb:=coalesce((ratings->>m.player_b::text)::double precision,parameters.starting_rating);
  ca:=coalesce((counts->>m.player_a::text)::bigint,0)+1;
  cb:=coalesce((counts->>m.player_b::text)::bigint,0)+1;
  expected:=1/(1+power(10::double precision,(rb-ra)/400));
  -- A tiebreak records no games, so its margin comes from points instead.
  if m.format='tiebreak' then won:=m.pa; lost:=m.pb; else won:=m.ga; lost:=m.gb; end if;
  share:=case when won+lost=0 then 0.5 else (case when m.winner=m.player_a then won else lost end)/(won+lost) end;
  multiplier:=1+parameters.mov_m*(greatest(0.5,least(1.0,share))-0.5)*2;
  change:=parameters.k*private.format_weight(m.format)*multiplier*((case when m.winner=m.player_a then 1 else 0 end)-expected);
  ratings:=ratings||jsonb_build_object(m.player_a::text,ra+change,m.player_b::text,rb-change);
  counts:=counts||jsonb_build_object(m.player_a::text,ca,m.player_b::text,cb);
  match_id:=m.id; group_id:=m.group_id; confirmed_at:=m.confirmed_at;
  player_id:=m.player_a; rating_before:=ra; rating_after:=ra+change; delta:=change; matches_played:=ca; return next;
  player_id:=m.player_b; rating_before:=rb; rating_after:=rb-change; delta:=-change; matches_played:=cb; return next;
 end loop;
end;
$$;
revoke all on function private.rating_events(uuid) from public,anon,authenticated;

comment on view public.group_standings is
 'Confirmed nonvoid singles results including inactive members. Walkovers and standalone tiebreaks count wins/losses but no games. Ratings are derived separately, weight short formats, and exclude walkovers.';
