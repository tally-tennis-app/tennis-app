-- Segment 5: matches, sets, and verification.
--
-- The rules live in docs/product-questions.md and ADR 0002. The short version:
-- a match counts only once the opponent confirms it, and a confirmed match is
-- never updated, deleted, or redated. An organizer may void one instead.
--
-- Every write goes through a SECURITY DEFINER function below. There is no
-- INSERT, UPDATE, or DELETE policy on either table, so a crafted direct write
-- has no path at all, and the guard triggers are a second line behind that.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Side A. Cascading on the players is the accepted account-deletion
  -- tradeoff in ADR 0002: deleting an account removes its matches.
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  -- Side B.
  opponent_id uuid not null references public.profiles (id) on delete cascade,
  winner_id uuid not null references public.profiles (id) on delete cascade,
  outcome text not null check (outcome in ('completed', 'retired', 'walkover')),
  -- Display and sorting only. The rating fold orders by confirmed_at.
  played_on date not null,
  -- Expired and voided are derived when read, never stored as a status.
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  -- Starts the 14-day confirmation window. An edit restarts it.
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  -- Makes a retried submission idempotent: the same form sent twice creates
  -- one match, not two.
  request_id uuid,
  created_at timestamptz not null default now(),
  constraint matches_distinct_players check (submitted_by <> opponent_id),
  constraint matches_winner_is_player
    check (winner_id = submitted_by or winner_id = opponent_id),
  constraint matches_confirmed_time
    check ((status = 'confirmed') = (confirmed_at is not null)),
  constraint matches_rejected_time
    check ((status = 'rejected') = (rejected_at is not null)),
  constraint matches_void_only_confirmed
    check (voided_at is null or status = 'confirmed'),
  constraint matches_void_reason
    check ((voided_at is null) = (void_reason is null)),
  constraint matches_void_reason_length
    check (void_reason is null or char_length(trim(void_reason)) between 1 and 200),
  constraint matches_rejection_reason_length
    check (rejection_reason is null or char_length(rejection_reason) <= 200),
  constraint matches_request_unique unique (submitted_by, request_id)
);

create index matches_group_id_idx on public.matches (group_id);
create index matches_submitted_by_idx on public.matches (submitted_by);
create index matches_opponent_id_idx on public.matches (opponent_id);
create index matches_confirmed_idx on public.matches (confirmed_at)
  where status = 'confirmed';

comment on column public.matches.played_on is
  'The date played. Display and sorting only: ratings fold by confirmed_at so a backdated match never rewrites history.';

create table public.match_sets (
  match_id uuid not null references public.matches (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 3),
  submitter_games smallint not null check (submitter_games between 0 and 7),
  opponent_games smallint not null check (opponent_games between 0 and 7),
  -- The tiebreak loser's points on a 7-6 set, as in 7-6(5).
  tiebreak_points smallint check (tiebreak_points between 0 and 99),
  primary key (match_id, set_number)
);

-- --------------------------------------------------------------------------
-- Immutability guards
--
-- The functions below already refuse to touch a confirmed match. These
-- triggers hold the line even against a future function that forgets to.
-- --------------------------------------------------------------------------

create function public.guard_confirmed_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'confirmed' then
    if (new.group_id, new.submitted_by, new.opponent_id, new.winner_id,
        new.outcome, new.played_on, new.status, new.submitted_at,
        new.confirmed_at)
       is distinct from
       (old.group_id, old.submitted_by, old.opponent_id, old.winner_id,
        old.outcome, old.played_on, old.status, old.submitted_at,
        old.confirmed_at) then
      raise exception 'A confirmed match cannot be changed' using errcode = '42501';
    end if;

    if old.voided_at is not null and new.voided_at is distinct from old.voided_at then
      raise exception 'That match is already void' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger matches_guard_confirmed
  before update on public.matches
  for each row
  execute function public.guard_confirmed_match();

create function public.guard_confirmed_sets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.matches
    where id = coalesce(new.match_id, old.match_id)
      and status = 'confirmed'
  ) then
    raise exception 'A confirmed match cannot be changed' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

-- On a cascaded account deletion the parent match is already gone when the
-- sets are removed, so this does not block the ADR 0002 deletion path.
create trigger match_sets_guard_confirmed
  before insert or update or delete on public.match_sets
  for each row
  execute function public.guard_confirmed_sets();

-- --------------------------------------------------------------------------
-- Row Level Security
--
-- A match is visible to members of its group, and always to its two players,
-- so a player who leaves a group can still see their own history.
-- --------------------------------------------------------------------------

alter table public.matches enable row level security;
alter table public.match_sets enable row level security;

create policy "matches_select_member_or_player"
  on public.matches
  for select
  to authenticated
  using (
    public.is_group_member(group_id)
    or (select auth.uid()) in (submitted_by, opponent_id)
  );

-- Runs the matches policy inside the subquery, so a set is visible exactly
-- when its match is.
create policy "match_sets_select_visible_match"
  on public.match_sets
  for select
  to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id));

-- --------------------------------------------------------------------------
-- Score validation
--
-- Mirrors src/lib/matches/score.ts. The database is the authority; the app
-- copy exists only to give instant feedback while a player types.
-- `sets` is a JSON array of {"a": games, "b": games, "tiebreak": points}.
-- Returns the winning side, 'a' or 'b', or null when the player must name
-- the winner (a retirement or walkover).
-- --------------------------------------------------------------------------

create function public.match_score_winner(match_outcome text, sets jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  set_count integer;
  a integer;
  b integer;
  tiebreak integer;
  high integer;
  low integer;
  wins_a integer := 0;
  wins_b integer := 0;
begin
  if match_outcome is null or match_outcome not in ('completed', 'retired', 'walkover') then
    raise exception 'Choose how the match ended' using errcode = '22023';
  end if;

  if sets is null or jsonb_typeof(sets) <> 'array' then
    raise exception 'The score is missing' using errcode = '22023';
  end if;

  set_count := jsonb_array_length(sets);

  if match_outcome = 'walkover' then
    if set_count > 0 then
      raise exception 'A walkover has no score' using errcode = '22023';
    end if;
    return null;
  end if;

  if set_count > 3 then
    raise exception 'A match has at most three sets' using errcode = '22023';
  end if;

  for i in 0 .. set_count - 1 loop
    a := (sets -> i ->> 'a')::integer;
    b := (sets -> i ->> 'b')::integer;
    tiebreak := (sets -> i ->> 'tiebreak')::integer;

    if a is null or b is null or a not between 0 and 7 or b not between 0 and 7 then
      raise exception 'Set %: games must be whole numbers from 0 to 7', i + 1
        using errcode = '22023';
    end if;

    if tiebreak is not null then
      if not ((a = 7 and b = 6) or (a = 6 and b = 7)) then
        raise exception 'Set %: tiebreak points only apply to a 7-6 set', i + 1
          using errcode = '22023';
      end if;
      if tiebreak not between 0 and 99 then
        raise exception 'Set %: enter the tiebreak loser''s points', i + 1
          using errcode = '22023';
      end if;
    end if;

    if wins_a = 2 or wins_b = 2 then
      raise exception 'The match was already decided before set %', i + 1
        using errcode = '22023';
    end if;

    high := greatest(a, b);
    low := least(a, b);

    if (high = 6 and low <= 4) or (high = 7 and low in (5, 6)) then
      if a > b then wins_a := wins_a + 1; else wins_b := wins_b + 1; end if;
    elsif match_outcome = 'completed' or i < set_count - 1 then
      -- Only a retirement may end on an unfinished set.
      raise exception 'Set %: %-% is not a finished set. Sets end 6-0 to 6-4, 7-5, or 7-6',
        i + 1, a, b
        using errcode = '22023';
    end if;
  end loop;

  if match_outcome = 'completed' then
    if wins_a = 2 then return 'a'; end if;
    if wins_b = 2 then return 'b'; end if;
    raise exception 'A completed match needs one player to win two sets'
      using errcode = '22023';
  end if;

  if wins_a = 2 or wins_b = 2 then
    raise exception 'One player already won two sets, so the match was completed'
      using errcode = '22023';
  end if;

  return null;
end;
$$;

-- Validates the score and resolves the winner for a submission or edit.
create function public.resolve_match_winner(
  match_outcome text,
  sets jsonb,
  side_a uuid,
  side_b uuid,
  named_winner uuid
)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  side text := public.match_score_winner(match_outcome, sets);
begin
  if side = 'a' then return side_a; end if;
  if side = 'b' then return side_b; end if;

  if named_winner is null or named_winner not in (side_a, side_b) then
    raise exception 'Choose who won the match' using errcode = '22023';
  end if;

  return named_winner;
end;
$$;

create function public.check_played_on(played date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  -- One day of slack: the database clock is UTC, and a player east of UTC
  -- can legitimately be on tomorrow's date.
  if played is null or played > current_date + 1 then
    raise exception 'The date played cannot be in the future' using errcode = '22023';
  end if;

  if played < current_date - 365 then
    raise exception 'Matches more than a year old cannot be logged'
      using errcode = '22023';
  end if;
end;
$$;

create function public.write_match_sets(target_match uuid, sets jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.match_sets where match_id = target_match;

  insert into public.match_sets
    (match_id, set_number, submitter_games, opponent_games, tiebreak_points)
  select
    target_match,
    (entry.ordinality)::smallint,
    (entry.value ->> 'a')::smallint,
    (entry.value ->> 'b')::smallint,
    (entry.value ->> 'tiebreak')::smallint
  from jsonb_array_elements(sets) with ordinality as entry;
end;
$$;

-- --------------------------------------------------------------------------
-- Match mutations
-- --------------------------------------------------------------------------

create function public.submit_match(
  target_group uuid,
  opponent uuid,
  played date,
  match_outcome text,
  sets jsonb,
  winner uuid default null,
  request uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  existing uuid;
  new_match uuid;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if request is not null then
    select id into existing
    from public.matches
    where submitted_by = actor and request_id = request;

    if existing is not null then
      return existing;
    end if;
  end if;

  if not public.is_group_member(target_group) then
    raise exception 'You are not a member of that group' using errcode = '42501';
  end if;

  if opponent is null or opponent = actor then
    raise exception 'Choose an opponent other than yourself' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = opponent and left_at is null
  ) then
    raise exception 'Your opponent is not an active member of that group'
      using errcode = '22023';
  end if;

  perform public.check_played_on(played);

  insert into public.matches
    (group_id, submitted_by, opponent_id, winner_id, outcome, played_on, request_id)
  values (
    target_group,
    actor,
    opponent,
    public.resolve_match_winner(match_outcome, sets, actor, opponent, winner),
    match_outcome,
    played,
    request
  )
  returning id into new_match;

  perform public.write_match_sets(new_match, sets);

  return new_match;
end;
$$;

-- The submitter corrects a pending or rejected submission. Either way it goes
-- back to pending, and the confirmation window starts again.
create function public.update_match(
  target_match uuid,
  played date,
  match_outcome text,
  sets jsonb,
  winner uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_match public.matches;
begin
  select * into current_match
  from public.matches
  where id = target_match and submitted_by = actor
  for update;

  if not found then
    raise exception 'Only the player who submitted a match can edit it'
      using errcode = '42501';
  end if;

  if current_match.status = 'confirmed' then
    raise exception 'A confirmed match cannot be changed' using errcode = '42501';
  end if;

  perform public.check_played_on(played);

  update public.matches
  set played_on = played,
      outcome = match_outcome,
      winner_id = public.resolve_match_winner(
        match_outcome, sets, current_match.submitted_by,
        current_match.opponent_id, winner),
      status = 'pending',
      submitted_at = now(),
      rejected_at = null,
      rejection_reason = null
  where id = target_match;

  perform public.write_match_sets(target_match, sets);
end;
$$;

create function public.withdraw_match(target_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_status text;
begin
  select status into match_status
  from public.matches
  where id = target_match and submitted_by = (select auth.uid())
  for update;

  if match_status is null then
    raise exception 'Only the player who submitted a match can withdraw it'
      using errcode = '42501';
  end if;

  if match_status = 'confirmed' then
    raise exception 'A confirmed match cannot be withdrawn' using errcode = '42501';
  end if;

  delete from public.matches where id = target_match;
end;
$$;

-- Shared by confirm and reject: only the opponent may answer, and only while
-- the submission is pending and inside its 14-day window.
create function public.lock_match_for_response(target_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_match public.matches;
begin
  select * into current_match
  from public.matches
  where id = target_match
  for update;

  if not found or current_match.opponent_id <> (select auth.uid()) then
    raise exception 'Only the opponent can confirm or reject a match'
      using errcode = '42501';
  end if;

  if current_match.status <> 'pending' then
    raise exception 'That match is no longer waiting for you' using errcode = '23514';
  end if;

  if current_match.submitted_at < now() - interval '14 days' then
    raise exception 'That submission expired after 14 days. Ask your opponent to submit it again'
      using errcode = '23514';
  end if;
end;
$$;

create function public.confirm_match(target_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_match_for_response(target_match);

  -- clock_timestamp, not now(): two confirmations in one transaction must
  -- still fold in the order they happened.
  update public.matches
  set status = 'confirmed', confirmed_at = clock_timestamp()
  where id = target_match;
end;
$$;

create function public.reject_match(target_match uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_match_for_response(target_match);

  update public.matches
  set status = 'rejected',
      rejected_at = now(),
      rejection_reason = nullif(left(trim(reason), 200), '')
  where id = target_match;
end;
$$;

-- Voiding replaces correcting (ADR 0002). The score is untouched; the match
-- drops out of the rating fold.
create function public.void_match(target_match uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_match public.matches;
begin
  select * into current_match
  from public.matches
  where id = target_match
  for update;

  if not found or not public.is_group_organizer(current_match.group_id) then
    raise exception 'Only an organizer of this group can void a match'
      using errcode = '42501';
  end if;

  if current_match.status <> 'confirmed' then
    raise exception 'Only a confirmed match can be voided' using errcode = '23514';
  end if;

  if current_match.voided_at is not null then
    raise exception 'That match is already void' using errcode = '23514';
  end if;

  if reason is null or char_length(trim(reason)) = 0 then
    raise exception 'Give a reason for voiding the match' using errcode = '22023';
  end if;

  update public.matches
  set voided_at = now(),
      voided_by = (select auth.uid()),
      void_reason = left(trim(reason), 200)
  where id = target_match;
end;
$$;

-- Helpers are internal; only the mutations are callable by players.
revoke execute on function
  public.guard_confirmed_match(),
  public.guard_confirmed_sets(),
  public.match_score_winner(text, jsonb),
  public.resolve_match_winner(text, jsonb, uuid, uuid, uuid),
  public.check_played_on(date),
  public.write_match_sets(uuid, jsonb),
  public.lock_match_for_response(uuid),
  public.submit_match(uuid, uuid, date, text, jsonb, uuid, uuid),
  public.update_match(uuid, date, text, jsonb, uuid),
  public.withdraw_match(uuid),
  public.confirm_match(uuid),
  public.reject_match(uuid, text),
  public.void_match(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.submit_match(uuid, uuid, date, text, jsonb, uuid, uuid),
  public.update_match(uuid, date, text, jsonb, uuid),
  public.withdraw_match(uuid),
  public.confirm_match(uuid),
  public.reject_match(uuid, text),
  public.void_match(uuid, text)
to authenticated, service_role;
