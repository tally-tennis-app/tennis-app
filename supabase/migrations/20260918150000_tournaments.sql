-- Segment 9: single-elimination tournaments (ADR 0004).
--
-- A tournament is a draw of ties. Each tie is settled by an ordinary verified
-- match, so tournament results use the same score rules, confirmation,
-- immutability, voiding, and rating fold as every other match. Advancement
-- happens here, in the database, when a tie's match is confirmed. Written
-- against the match model in 20260913010000_matches.sql.
--
-- As with matches, there are no write policies: every change goes through a
-- SECURITY DEFINER function below.

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  status text not null default 'registration'
    check (status in ('registration', 'in_progress', 'completed', 'cancelled')),
  entrant_cap smallint not null check (entrant_cap in (4, 8, 16, 32)),
  seeding text not null default 'rating' check (seeding in ('rating', 'random')),
  -- Round n is due n * round_days after the start. Guidance only.
  round_days smallint not null default 7 check (round_days between 1 and 60),
  -- Set at the draw: the smallest power of two that fits the entrants.
  draw_size smallint,
  champion_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  constraint tournaments_name_length check (char_length(trim(name)) between 1 and 80),
  constraint tournaments_cancel_reason_length
    check (cancel_reason is null or char_length(cancel_reason) <= 200)
);

create index tournaments_group_id_idx on public.tournaments (group_id);

create table public.tournament_entrants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seed smallint,
  -- clock_timestamp, not now(): registration order breaks seeding ties, so two
  -- entries in one transaction must still get distinct times.
  registered_at timestamptz not null default clock_timestamp(),
  withdrawn_at timestamptz,
  primary key (tournament_id, user_id)
);

create index tournament_entrants_user_id_idx on public.tournament_entrants (user_id);

create table public.tournament_ties (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  -- 1 is the first round; the highest round is the final.
  round smallint not null check (round >= 1),
  position smallint not null check (position >= 0),
  player_a uuid references public.profiles (id) on delete set null,
  player_b uuid references public.profiles (id) on delete set null,
  winner_id uuid references public.profiles (id) on delete set null,
  decided_by text
    check (decided_by in ('match', 'bye', 'walkover', 'withdrawal', 'no_show')),
  decided_at timestamptz,
  -- The one live submission for this tie.
  match_id uuid references public.matches (id) on delete set null,
  deadline date,
  unique (tournament_id, round, position),
  constraint tournament_ties_decided check ((decided_by is null) = (decided_at is null))
);

alter table public.matches
  add column tournament_tie_id uuid references public.tournament_ties (id) on delete set null;

create index matches_tournament_tie_id_idx on public.matches (tournament_tie_id);

-- Consequential organizer actions are recorded, not left to transient toasts.
create table public.tournament_events (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  actor uuid references public.profiles (id) on delete set null,
  kind text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index tournament_events_tournament_id_idx on public.tournament_events (tournament_id);

-- --------------------------------------------------------------------------
-- Visibility
--
-- A tournament is visible to the members of its group, the same boundary as
-- the group's matches. The predicate is a function because the child-table
-- policies cannot subquery tournaments without recursing.
-- --------------------------------------------------------------------------

create function public.can_see_tournament(target uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = target and public.is_group_member(t.group_id)
  );
$$;

alter table public.tournaments enable row level security;
alter table public.tournament_entrants enable row level security;
alter table public.tournament_ties enable row level security;
alter table public.tournament_events enable row level security;

create policy "tournaments_select_visible" on public.tournaments
  for select to authenticated using (public.can_see_tournament(id));
create policy "tournament_entrants_select_visible" on public.tournament_entrants
  for select to authenticated using (public.can_see_tournament(tournament_id));
create policy "tournament_ties_select_visible" on public.tournament_ties
  for select to authenticated using (public.can_see_tournament(tournament_id));
create policy "tournament_events_select_visible" on public.tournament_events
  for select to authenticated using (public.can_see_tournament(tournament_id));

-- Reads only, as for matches: every write goes through a function below.
revoke all on public.tournaments, public.tournament_entrants,
  public.tournament_ties, public.tournament_events from public, anon, authenticated;
grant select on public.tournaments, public.tournament_entrants,
  public.tournament_ties, public.tournament_events to authenticated;
grant all on public.tournaments, public.tournament_entrants,
  public.tournament_ties, public.tournament_events to service_role;

-- --------------------------------------------------------------------------
-- Draw mechanics (internal)
-- --------------------------------------------------------------------------

-- Standard seed order: 1 and 2 can only meet in the final, and byes (seeds
-- beyond the field) fall to the top seeds. For 8: 1,8,4,5,2,7,3,6.
create function public.bracket_order(size integer)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  seeds integer[] := array[1];
  expanded integer[];
  n integer := 1;
  s integer;
begin
  while n < size loop
    n := n * 2;
    expanded := '{}';
    foreach s in array seeds loop
      expanded := expanded || s || (n + 1 - s);
    end loop;
    seeds := expanded;
  end loop;
  return seeds;
end;
$$;

create function public.tournament_rounds(target uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select max(round)::integer from public.tournament_ties where tournament_id = target;
$$;

create function public.log_tournament_event(target uuid, event_kind text, event_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tournament_events (tournament_id, actor, kind, detail)
  values (target, (select auth.uid()), event_kind, event_detail);
$$;

create function public.is_withdrawn(target uuid, player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournament_entrants
    where tournament_id = target and user_id = player and withdrawn_at is not null
  );
$$;

-- Moves a decided tie's winner on, or crowns the champion after the final.
-- A null winner (both players out) leaves the next slot empty for good.
create function public.place_winner(target_tie uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tie public.tournament_ties;
begin
  select * into tie from public.tournament_ties where id = target_tie;

  if tie.round = public.tournament_rounds(tie.tournament_id) then
    update public.tournaments
    set status = 'completed', champion_id = tie.winner_id, completed_at = now()
    where id = tie.tournament_id;
    return;
  end if;

  if tie.position % 2 = 0 then
    update public.tournament_ties set player_a = tie.winner_id
    where tournament_id = tie.tournament_id and round = tie.round + 1
      and position = tie.position / 2;
  else
    update public.tournament_ties set player_b = tie.winner_id
    where tournament_id = tie.tournament_id and round = tie.round + 1
      and position = tie.position / 2;
  end if;
end;
$$;

-- Decides every tie that no longer needs a match: byes, ties where a player
-- withdrew, and ties where nobody is left. Repeats until nothing changes,
-- because one decision can make the next round's tie decidable.
create function public.settle_tournament(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tie public.tournament_ties;
  changed boolean := true;
  slot_a_final boolean;
  slot_b_final boolean;
  a_in boolean;
  b_in boolean;
  chosen uuid;
  reason text;
begin
  if (select status from public.tournaments where id = target) <> 'in_progress' then
    return;
  end if;

  while changed loop
    changed := false;

    for tie in
      select * from public.tournament_ties
      where tournament_id = target and decided_at is null
      order by round, position
    loop
      -- The loop's rows were read before this pass placed any winners, so
      -- reread the tie: judging a stale copy would see filled slots as empty.
      select * into tie from public.tournament_ties where id = tie.id;
      if tie.decided_at is not null then
        continue;
      end if;

      -- A slot is final once it is filled or its feeder tie is decided.
      slot_a_final := tie.round = 1 or tie.player_a is not null or exists (
        select 1 from public.tournament_ties f
        where f.tournament_id = target and f.round = tie.round - 1
          and f.position = tie.position * 2 and f.decided_at is not null);
      slot_b_final := tie.round = 1 or tie.player_b is not null or exists (
        select 1 from public.tournament_ties f
        where f.tournament_id = target and f.round = tie.round - 1
          and f.position = tie.position * 2 + 1 and f.decided_at is not null);

      if not (slot_a_final and slot_b_final) then
        continue;
      end if;

      a_in := tie.player_a is not null and not public.is_withdrawn(target, tie.player_a);
      b_in := tie.player_b is not null and not public.is_withdrawn(target, tie.player_b);

      if a_in and b_in then
        continue;
      end if;

      chosen := case when a_in then tie.player_a when b_in then tie.player_b end;
      reason := case
        when tie.player_a is not null and not a_in then 'withdrawal'
        when tie.player_b is not null and not b_in then 'withdrawal'
        when chosen is not null then 'bye'
        else 'no_show'
      end;

      update public.tournament_ties
      set winner_id = chosen, decided_by = reason, decided_at = now()
      where id = tie.id;

      perform public.place_winner(tie.id);
      changed := true;

      -- The final may just have been decided.
      if (select status from public.tournaments where id = target) <> 'in_progress' then
        return;
      end if;
    end loop;
  end loop;
end;
$$;

create function public.require_tournament_organizer(target uuid)
returns public.tournaments
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments;
begin
  select * into t from public.tournaments where id = target for update;
  if not found or not public.is_group_organizer(t.group_id) then
    raise exception 'Only an organizer of this group can manage the tournament'
      using errcode = '42501';
  end if;
  return t;
end;
$$;

-- --------------------------------------------------------------------------
-- Advancement: reacts to a tournament match being confirmed or voided.
-- --------------------------------------------------------------------------

create function public.tournament_match_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tie public.tournament_ties;
  next_tie public.tournament_ties;
  t public.tournaments;
begin
  if new.tournament_tie_id is null then
    return new;
  end if;

  select * into tie from public.tournament_ties where id = new.tournament_tie_id;
  select * into t from public.tournaments where id = tie.tournament_id;

  if t.status not in ('in_progress', 'completed') then
    return new;
  end if;

  if new.status = 'confirmed' and old.status <> 'confirmed'
     and tie.match_id = new.id and tie.decided_at is null then
    update public.tournament_ties
    set winner_id = new.winner, decided_by = 'match', decided_at = now()
    where id = tie.id;

    perform public.place_winner(tie.id);
    perform public.settle_tournament(t.id);
    return new;
  end if;

  if new.voided_at is not null and old.voided_at is null
     and tie.match_id = new.id and tie.decided_by = 'match' then
    if tie.round < public.tournament_rounds(t.id) then
      select * into next_tie from public.tournament_ties
      where tournament_id = t.id and round = tie.round + 1 and position = tie.position / 2;

      if next_tie.match_id is not null or next_tie.decided_at is not null then
        raise exception 'The next round already has a result, so this match stands'
          using errcode = '23514';
      end if;

      if tie.position % 2 = 0 then
        update public.tournament_ties set player_a = null where id = next_tie.id;
      else
        update public.tournament_ties set player_b = null where id = next_tie.id;
      end if;
    else
      update public.tournaments
      set status = 'in_progress', champion_id = null, completed_at = null
      where id = t.id;
    end if;

    update public.tournament_ties
    set winner_id = null, decided_by = null, decided_at = null, match_id = null
    where id = tie.id;

    perform public.log_tournament_event(t.id, 'result_voided',
      format('Round %s result voided; the tie needs a new result', tie.round));
  end if;

  return new;
end;
$$;

create trigger matches_tournament_advance
  after update of status, voided_at on public.matches
  for each row
  execute function public.tournament_match_changed();

-- --------------------------------------------------------------------------
-- Player and organizer functions
-- --------------------------------------------------------------------------

create function public.create_tournament(
  target_group uuid,
  tournament_name text,
  cap integer,
  seeding_method text default 'rating',
  days_per_round integer default 7
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

  insert into public.tournaments
    (group_id, name, created_by, entrant_cap, seeding, round_days)
  values
    (target_group, trim(tournament_name), (select auth.uid()), cap, seeding_method, days_per_round)
  returning id into new_tournament;

  perform public.log_tournament_event(new_tournament, 'created', 'Registration opened');
  return new_tournament;
end;
$$;

create function public.register_for_tournament(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments;
begin
  select * into t from public.tournaments where id = target for update;

  if not found or not public.is_group_member(t.group_id) then
    raise exception 'Only members of the group can enter this tournament'
      using errcode = '42501';
  end if;

  if t.status <> 'registration' then
    raise exception 'Registration for this tournament is closed' using errcode = '23514';
  end if;

  if exists (select 1 from public.tournament_entrants
             where tournament_id = target and user_id = (select auth.uid())) then
    return;
  end if;

  if (select count(*) from public.tournament_entrants where tournament_id = target)
     >= t.entrant_cap then
    raise exception 'This tournament is full' using errcode = '23514';
  end if;

  insert into public.tournament_entrants (tournament_id, user_id)
  values (target, (select auth.uid()));
end;
$$;

create function public.unregister_from_tournament(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select status from public.tournaments where id = target) is distinct from 'registration' then
    raise exception 'The draw has been made. Withdraw instead' using errcode = '23514';
  end if;

  delete from public.tournament_entrants
  where tournament_id = target and user_id = (select auth.uid());
end;
$$;

create function public.start_tournament(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments := public.require_tournament_organizer(target);
  field_size integer;
  size integer := 2;
  rounds integer := 1;
  seeds integer[];
  seeded uuid[];
begin
  if t.status <> 'registration' then
    raise exception 'This tournament has already started' using errcode = '23514';
  end if;

  select count(*) into field_size from public.tournament_entrants where tournament_id = target;
  if field_size < 2 then
    raise exception 'A tournament needs at least two entrants' using errcode = '23514';
  end if;

  while size < field_size loop
    size := size * 2;
    rounds := rounds + 1;
  end loop;

  -- Seed 1 first. By rating: the group rating from the same fold as the
  -- standings, unrated players at 1500, earlier registration breaking ties.
  if t.seeding = 'rating' then
    select array_agg(e.user_id order by coalesce(f.rating_after, 1500) desc, e.registered_at)
    into seeded
    from public.tournament_entrants e
    left join (
      select distinct on (r.player_id) r.player_id, r.rating_after
      from private.rating_events(t.group_id) r
      order by r.player_id, r.confirmed_at desc, r.match_id desc
    ) f on f.player_id = e.user_id
    where e.tournament_id = target;
  else
    select array_agg(user_id order by random()) into seeded
    from public.tournament_entrants where tournament_id = target;
  end if;

  for i in 1 .. field_size loop
    update public.tournament_entrants set seed = i
    where tournament_id = target and user_id = seeded[i];
  end loop;

  for r in 1 .. rounds loop
    insert into public.tournament_ties (tournament_id, round, position, deadline)
    select target, r, p, current_date + t.round_days * r
    from generate_series(0, size / (2 ^ r)::integer - 1) as p;
  end loop;

  seeds := public.bracket_order(size);
  for p in 0 .. size / 2 - 1 loop
    update public.tournament_ties
    set player_a = case when seeds[2 * p + 1] <= field_size then seeded[seeds[2 * p + 1]] end,
        player_b = case when seeds[2 * p + 2] <= field_size then seeded[seeds[2 * p + 2]] end
    where tournament_id = target and round = 1 and position = p;
  end loop;

  update public.tournaments
  set status = 'in_progress', started_at = now(), draw_size = size
  where id = target;

  perform public.log_tournament_event(target, 'started',
    format('Draw made for %s entrants', field_size));
  perform public.settle_tournament(target);
end;
$$;

-- Either player submits the tie's result. It is an ordinary match, validated
-- and stored by the same functions as submit_match(), with a link to the tie;
-- confirming it advances the winner.
create function public.submit_tournament_match(
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
    sets, match_played_on, match_retired_by);

  insert into public.matches
    (group_id, player_a, player_b, played_on, outcome, retired_by, winner,
     submitted_by, tournament_tie_id)
  values
    (t.group_id, actor, opponent, match_played_on, match_outcome, match_retired_by,
     match_winner, actor, tie.id)
  returning * into result;

  perform public.replace_match_sets(result.id, sets);
  update public.tournament_ties set match_id = result.id where id = tie.id;
  return result;
end;
$$;

-- A player withdraws themselves; an organizer may withdraw anyone.
create function public.withdraw_from_tournament(target uuid, player uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  who uuid := coalesce(player, actor);
  t public.tournaments;
  open_tie public.tournament_ties;
begin
  select * into t from public.tournaments where id = target for update;

  if not found then
    raise exception 'That tournament could not be found' using errcode = '42501';
  end if;

  if who <> actor and not public.is_group_organizer(t.group_id) then
    raise exception 'Only an organizer can withdraw another player' using errcode = '42501';
  end if;

  if t.status = 'registration' then
    delete from public.tournament_entrants where tournament_id = target and user_id = who;
    return;
  end if;

  if t.status <> 'in_progress' then
    raise exception 'This tournament has finished' using errcode = '23514';
  end if;

  if not exists (select 1 from public.tournament_entrants
                 where tournament_id = target and user_id = who and withdrawn_at is null) then
    raise exception 'That player is not in this tournament' using errcode = '23514';
  end if;

  if exists (select 1 from public.tournament_ties
             where tournament_id = target and decided_at is not null
               and who in (player_a, player_b) and winner_id is distinct from who) then
    raise exception 'That player is already out of the tournament' using errcode = '23514';
  end if;

  update public.tournament_entrants set withdrawn_at = now()
  where tournament_id = target and user_id = who;

  -- A pending result on their current tie no longer matters.
  select * into open_tie from public.tournament_ties
  where tournament_id = target and decided_at is null and who in (player_a, player_b);

  if open_tie.match_id is not null then
    delete from public.matches where id = open_tie.match_id and status <> 'confirmed';
  end if;

  perform public.log_tournament_event(target, 'withdrawal',
    format('%s withdrew', (select display_name from public.profiles where id = who)));
  perform public.settle_tournament(target);
end;
$$;

create function public.decide_tie_by_organizer(target_tie uuid, winner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tie public.tournament_ties;
  t public.tournaments;
begin
  select * into tie from public.tournament_ties where id = target_tie for update;
  if not found then
    raise exception 'That tie could not be found' using errcode = '42501';
  end if;

  t := public.require_tournament_organizer(tie.tournament_id);

  if t.status <> 'in_progress' or tie.decided_at is not null then
    raise exception 'This tie is no longer open' using errcode = '23514';
  end if;

  if tie.player_a is null or tie.player_b is null then
    raise exception 'This tie does not have two players yet' using errcode = '23514';
  end if;

  if winner is not null and winner not in (tie.player_a, tie.player_b) then
    raise exception 'The winner must be one of the two players' using errcode = '22023';
  end if;

  if tie.match_id is not null then
    delete from public.matches where id = tie.match_id and status <> 'confirmed';
  end if;

  update public.tournament_ties
  set winner_id = winner,
      decided_by = case when winner is null then 'no_show' else 'walkover' end,
      decided_at = now(),
      match_id = null
  where id = tie.id;

  perform public.log_tournament_event(t.id,
    case when winner is null then 'no_show' else 'walkover' end,
    case when winner is null
      then format('Round %s tie: neither player played, both are out', tie.round)
      else format('Round %s tie: walkover to %s', tie.round,
                  (select display_name from public.profiles where id = winner))
    end);

  perform public.place_winner(tie.id);
  perform public.settle_tournament(t.id);
end;
$$;

create function public.cancel_tournament(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments := public.require_tournament_organizer(target);
begin
  if t.status not in ('registration', 'in_progress') then
    raise exception 'This tournament has already finished' using errcode = '23514';
  end if;

  if reason is null or char_length(trim(reason)) = 0 then
    raise exception 'Give a reason for cancelling' using errcode = '22023';
  end if;

  -- Pending tournament results become ordinary pending matches.
  update public.matches set tournament_tie_id = null
  where status <> 'confirmed'
    and tournament_tie_id in (select id from public.tournament_ties where tournament_id = target);

  update public.tournaments
  set status = 'cancelled', cancelled_at = now(), cancel_reason = left(trim(reason), 200)
  where id = target;

  perform public.log_tournament_event(target, 'cancelled', left(trim(reason), 200));
end;
$$;

revoke execute on function
  public.can_see_tournament(uuid),
  public.bracket_order(integer),
  public.tournament_rounds(uuid),
  public.log_tournament_event(uuid, text, text),
  public.is_withdrawn(uuid, uuid),
  public.place_winner(uuid),
  public.settle_tournament(uuid),
  public.require_tournament_organizer(uuid),
  public.tournament_match_changed(),
  public.create_tournament(uuid, text, integer, text, integer),
  public.register_for_tournament(uuid),
  public.unregister_from_tournament(uuid),
  public.start_tournament(uuid),
  public.submit_tournament_match(uuid, text, uuid, jsonb, date, uuid),
  public.withdraw_from_tournament(uuid, uuid),
  public.decide_tie_by_organizer(uuid, uuid),
  public.cancel_tournament(uuid, text)
from public, anon, authenticated;

-- The visibility predicate is called from policies, so the querying role
-- needs it.
grant execute on function
  public.can_see_tournament(uuid),
  public.create_tournament(uuid, text, integer, text, integer),
  public.register_for_tournament(uuid),
  public.unregister_from_tournament(uuid),
  public.start_tournament(uuid),
  public.submit_tournament_match(uuid, text, uuid, jsonb, date, uuid),
  public.withdraw_from_tournament(uuid, uuid),
  public.decide_tie_by_organizer(uuid, uuid),
  public.cancel_tournament(uuid, text)
to authenticated, service_role;
