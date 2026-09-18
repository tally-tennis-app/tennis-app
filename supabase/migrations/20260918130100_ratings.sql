-- Segment 6: derived ratings.
--
-- ADR 0002: ratings are never stored. They are a fold over confirmed,
-- non-void matches, ordered by confirmation time. Ordering by played_on
-- instead would let a backdated match rewrite history, and is a correctness
-- bug, not a preference. supabase/tests/ratings.test.sql guards it.

create function public.rating_fold(target_group uuid default null)
returns table (
  match_id uuid,
  group_id uuid,
  confirmed_at timestamptz,
  player_id uuid,
  opponent_id uuid,
  won boolean,
  rating_before numeric,
  rating_after numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- The only place these calibration knobs appear (ADR 0002).
  k constant numeric := 32;
  mov_m constant numeric := 0.25;
  starting_rating constant numeric := 1500;
  ratings jsonb := '{}'::jsonb;
  m record;
  winner_rating numeric;
  loser_rating numeric;
  expected numeric;
  share numeric;
  delta numeric;
begin
  for m in
    select
      mt.id,
      mt.group_id,
      mt.confirmed_at,
      mt.winner_id,
      case when mt.winner_id = mt.submitted_by then mt.opponent_id
           else mt.submitted_by end as loser_id,
      coalesce(sum(case when mt.winner_id = mt.submitted_by
                        then s.submitter_games else s.opponent_games end), 0)
        as winner_games,
      coalesce(sum(s.submitter_games + s.opponent_games), 0) as total_games
    from public.matches mt
    left join public.match_sets s on s.match_id = mt.id
    where mt.status = 'confirmed'
      and mt.voided_at is null
      -- Walkovers are skipped: no tennis was played.
      and mt.outcome <> 'walkover'
      and (target_group is null or mt.group_id = target_group)
    group by mt.id
    order by mt.confirmed_at, mt.id
  loop
    winner_rating := coalesce((ratings ->> m.winner_id::text)::numeric, starting_rating);
    loser_rating := coalesce((ratings ->> m.loser_id::text)::numeric, starting_rating);

    expected := 1 / (1 + power(10::numeric, (loser_rating - winner_rating) / 400));
    -- Bounded linear game share: 1.0x for a grind, up to 1.25x for 6-0 6-0.
    -- A retirement at 0-0 has no games and rates at the base multiplier.
    share := case when m.total_games = 0 then 0.5
                  else greatest(m.winner_games::numeric / m.total_games, 0.5) end;
    delta := k * (1 + mov_m * (share - 0.5) * 2) * (1 - expected);

    ratings := ratings || jsonb_build_object(
      m.winner_id::text, winner_rating + delta,
      m.loser_id::text, loser_rating - delta
    );

    match_id := m.id;
    group_id := m.group_id;
    confirmed_at := m.confirmed_at;

    player_id := m.winner_id;
    opponent_id := m.loser_id;
    won := true;
    rating_before := winner_rating;
    rating_after := winner_rating + delta;
    return next;

    player_id := m.loser_id;
    opponent_id := m.winner_id;
    won := false;
    rating_before := loser_rating;
    rating_after := loser_rating - delta;
    return next;
  end loop;
end;
$$;

comment on function public.rating_fold(uuid) is
  'Internal. Folds every confirmed, non-void, non-walkover match in confirmation order. Not callable by players: rating_history() and standings() filter it to what the caller may see.';

-- The fold over the whole app, filtered to matches the caller can see. A
-- player's global rating counts matches in groups the caller is not in, but
-- the caller only receives rows for matches they could open themselves.
create function public.rating_history(
  target_group uuid default null,
  target_player uuid default null
)
returns table (
  match_id uuid,
  group_id uuid,
  confirmed_at timestamptz,
  player_id uuid,
  opponent_id uuid,
  won boolean,
  rating_before numeric,
  rating_after numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.*
  from public.rating_fold(target_group) f
  join public.matches mt on mt.id = f.match_id
  where (target_group is null or public.is_group_member(target_group))
    and (target_player is null or f.player_id = target_player)
    and (
      public.is_group_member(mt.group_id)
      or (select auth.uid()) in (mt.submitted_by, mt.opponent_id)
    );
$$;

-- Group standings include every member, departed ones marked inactive once
-- they have a result. Global standings cover the caller and everyone in the
-- caller's active groups, with each player's rating across all their matches.
create function public.standings(target_group uuid default null)
returns table (
  player_id uuid,
  display_name text,
  rating numeric,
  played integer,
  wins integer,
  losses integer,
  form text,
  last_delta numeric,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if target_group is not null and not public.is_group_member(target_group) then
    return;
  end if;

  return query
  with fold as (
    select
      f.player_id,
      f.won,
      f.rating_after,
      f.rating_after - f.rating_before as delta,
      row_number() over (
        partition by f.player_id
        order by f.confirmed_at desc, f.match_id desc
      ) as recency
    from public.rating_fold(target_group) f
  ),
  people as (
    select gm.user_id, bool_or(gm.left_at is null) as active
    from public.group_members gm
    where (target_group is not null and gm.group_id = target_group)
       or (target_group is null
           and gm.left_at is null
           and public.is_group_member(gm.group_id))
    group by gm.user_id
  )
  select
    p.user_id,
    pr.display_name,
    -- 1500 is the starting rating also named in rating_fold().
    coalesce((select f.rating_after from fold f
              where f.player_id = p.user_id and f.recency = 1), 1500),
    (select count(*)::integer from fold f where f.player_id = p.user_id),
    (select count(*)::integer from fold f where f.player_id = p.user_id and f.won),
    (select count(*)::integer from fold f where f.player_id = p.user_id and not f.won),
    coalesce((select string_agg(case when f.won then 'W' else 'L' end, '' order by f.recency)
              from fold f where f.player_id = p.user_id and f.recency <= 5), ''),
    (select f.delta from fold f where f.player_id = p.user_id and f.recency = 1),
    p.active
  from people p
  join public.profiles pr on pr.id = p.user_id
  where p.active
     or exists (select 1 from fold f where f.player_id = p.user_id);
end;
$$;

revoke execute on function
  public.rating_fold(uuid),
  public.rating_history(uuid, uuid),
  public.standings(uuid)
from public, anon, authenticated;

grant execute on function
  public.rating_history(uuid, uuid),
  public.standings(uuid)
to authenticated, service_role;
