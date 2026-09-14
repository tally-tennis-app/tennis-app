-- Best-of-three singles; normalized scores and an RPC-only write boundary.
-- All match mutations lock group -> match. Membership writes lock the same
-- group, so a submit/confirm cannot race a departure or removal.
create function public.lock_match_membership_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform 1 from public.groups where id = old.group_id for update;
    return old;
  end if;
  perform 1 from public.groups where id = new.group_id for update;
  return new;
end;
$$;
revoke all on function public.lock_match_membership_group() from public, anon, authenticated;
create trigger group_members_match_lock before insert or update or delete
on public.group_members for each row execute function public.lock_match_membership_group();

-- This immutable predicate is shared by the CHECK and composite validator.
create function public.is_legal_match_set(a integer, b integer, ta integer, tb integer, done boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  set_finished boolean;
  high_points integer;
  low_points integer;
begin
  if a is null or b is null or done is null or a < 0 or b < 0 or a > 7 or b > 7 then return false; end if;
  set_finished := (greatest(a,b)=6 and least(a,b)<=4)
                  or (greatest(a,b)=7 and least(a,b) in (5,6));
  if done <> set_finished then return false; end if;
  if not done and (a>6 or b>6) then return false; end if;
  if (ta is null) <> (tb is null) then return false; end if;
  if ta is null then return true; end if;
  if ta<0 or tb<0 then return false; end if;
  high_points := greatest(ta,tb); low_points := least(ta,tb);
  if done then
    return greatest(a,b)=7 and least(a,b)=6
      and ((a>b and ta>tb) or (b>a and tb>ta))
      and ((high_points=7 and low_points<=5)
           or (high_points>=8 and high_points::bigint-low_points=2));
  end if;
  -- Retiring in a tiebreak: only a still-live 6-6 score is meaningful.
  return a=6 and b=6 and (high_points<7 or high_points::bigint-low_points<2);
end;
$$;
revoke all on function public.is_legal_match_set(integer,integer,integer,integer,boolean) from public, anon, authenticated;

create table public.matches (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.groups(id) on delete cascade,
 player_a uuid not null references public.profiles(id) on delete cascade,
 player_b uuid not null references public.profiles(id) on delete cascade,
 played_on date not null default current_date check (isfinite(played_on) and played_on<=current_date),
 outcome text not null check (outcome in ('completed','retired','walkover')),
 retired_by uuid references public.profiles(id) on delete cascade,
 winner uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
 submitted_by uuid not null references public.profiles(id) on delete cascade,
 confirmed_at timestamptz,
 voided_at timestamptz,
 voided_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 check (player_a<>player_b),
 check (submitted_by in (player_a,player_b)),
 check (winner in (player_a,player_b)),
 check ((outcome='retired' and retired_by is not null and retired_by in (player_a,player_b) and retired_by<>winner)
     or (outcome<>'retired' and retired_by is null)),
 check ((status='confirmed')=(confirmed_at is not null)),
 check (voided_at is null or status='confirmed'),
 check (voided_by is null or voided_at is not null)
);
create index matches_group_history_idx on public.matches(group_id,played_on desc,created_at desc);
create index matches_player_a_idx on public.matches(player_a,played_on desc);
create index matches_player_b_idx on public.matches(player_b,played_on desc);
create index matches_confirmed_idx on public.matches(confirmed_at,id) where status='confirmed' and voided_at is null;

create table public.match_sets (
 match_id uuid not null references public.matches(id) on delete cascade,
 set_number integer not null check (set_number between 1 and 3),
 games_a integer not null,
 games_b integer not null,
 tiebreak_a integer,
 tiebreak_b integer,
 complete boolean not null,
 primary key (match_id,set_number),
 constraint match_sets_legal_score check (public.is_legal_match_set(games_a,games_b,tiebreak_a,tiebreak_b,complete))
);
alter table public.matches enable row level security;
alter table public.match_sets enable row level security;
create policy matches_select_member on public.matches for select to authenticated
 using (public.is_group_member(group_id));
create policy match_sets_select_member on public.match_sets for select to authenticated
 using (exists(select 1 from public.matches m where m.id=match_id and public.is_group_member(m.group_id)));
-- No mutation policies; explicitly remove Supabase's default table write grants.
revoke all on public.matches,public.match_sets from public,anon,authenticated;
grant select on public.matches,public.match_sets to authenticated;
grant all on public.matches,public.match_sets to service_role;

create function public.validate_match_score(a uuid,b uuid,match_outcome text,match_winner uuid,sets jsonb,match_played_on date,match_retired_by uuid)
returns void language plpgsql set search_path = '' as $$
declare
 s jsonb; n integer; i integer := 0; aw integer := 0; bw integer := 0;
 ga integer; gb integer; ta integer; tb integer; done boolean;
begin
 if a is null or b is null or a=b or match_winner is null or match_winner not in (a,b)
   or match_outcome is null or match_outcome not in ('completed','retired','walkover')
   or match_played_on is null or not isfinite(match_played_on) or match_played_on>current_date
   or sets is null or jsonb_typeof(sets)<>'array' then
   raise exception 'Invalid match details' using errcode='22023';
 end if;
 n := jsonb_array_length(sets);
 if match_outcome='walkover' then
   if n<>0 or match_retired_by is not null then raise exception 'Walkovers cannot have a score or retiring player' using errcode='22023'; end if;
   return;
 end if;
 if n not between 1 and 3
   or (match_outcome='completed' and (n<2 or match_retired_by is not null))
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
     or (s->'tiebreak_b' is not null and s->'tiebreak_b'<>'null'::jsonb and not coalesce((s->>'tiebreak_b') ~ '^[0-9]+$' and jsonb_typeof(s->'tiebreak_b')='number',false)) then
     raise exception 'Invalid set fields' using errcode='22023';
   end if;
   ga := (s->>'games_a')::integer; gb := (s->>'games_b')::integer;
   ta := (s->>'tiebreak_a')::integer; tb := (s->>'tiebreak_b')::integer;
   done := (s->>'complete')::boolean;
   if (s->>'set_number')::integer<>i or aw=2 or bw=2
     or not public.is_legal_match_set(ga,gb,ta,tb,done)
     or (not done and (match_outcome<>'retired' or i<>n)) then
     raise exception 'Invalid set score or order' using errcode='22023';
   end if;
   if done then
     if ga>gb then aw:=aw+1; else bw:=bw+1; end if;
   end if;
 end loop;
 if (match_outcome='completed' and not ((aw=2 and match_winner=a) or (bw=2 and match_winner=b)))
   or (match_outcome='retired' and (aw=2 or bw=2)) then
   raise exception 'Score does not match outcome or winner' using errcode='22023';
 end if;
exception when numeric_value_out_of_range or invalid_text_representation then
 raise exception 'Invalid numeric score' using errcode='22023';
end;
$$;
revoke all on function public.validate_match_score(uuid,uuid,text,uuid,jsonb,date,uuid) from public,anon,authenticated;

create function public.replace_match_sets(target_match uuid,sets jsonb)
returns void language sql set search_path = '' as $$
 delete from public.match_sets where match_id=target_match;
 insert into public.match_sets(match_id,set_number,games_a,games_b,tiebreak_a,tiebreak_b,complete)
 select target_match,(s->>'set_number')::integer,(s->>'games_a')::integer,(s->>'games_b')::integer,
   (s->>'tiebreak_a')::integer,(s->>'tiebreak_b')::integer,(s->>'complete')::boolean
 from jsonb_array_elements(sets) s;
$$;
revoke all on function public.replace_match_sets(uuid,jsonb) from public,anon,authenticated;

create function public.submit_match(target_group uuid,opponent uuid,match_outcome text,match_winner uuid,sets jsonb,match_played_on date default current_date,match_retired_by uuid default null)
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
 perform public.validate_match_score(actor,opponent,match_outcome,match_winner,sets,match_played_on,match_retired_by);
 insert into public.matches(group_id,player_a,player_b,played_on,outcome,retired_by,winner,submitted_by)
 values(target_group,actor,opponent,match_played_on,match_outcome,match_retired_by,match_winner,actor) returning * into result;
 perform public.replace_match_sets(result.id,sets);
 return result;
end;
$$;

-- Private lock/authorization helper. It deliberately reports the same error for
-- missing ids and groups the caller cannot access. No information-returning
-- definer helper is exposed to clients.
create function public.lock_member_match(target_match uuid)
returns public.matches language plpgsql set search_path = '' as $$
declare result public.matches; target_group uuid;
begin
 select group_id into target_group from public.matches where id=target_match;
 perform 1 from public.groups where id=target_group for update;
 if auth.uid() is null or not public.is_group_member(target_group) then
   raise exception 'Match is not available' using errcode='42501';
 end if;
 select * into result from public.matches where id=target_match for update;
 if not found then raise exception 'Match is not available' using errcode='42501'; end if;
 return result;
end;
$$;
revoke all on function public.lock_member_match(uuid) from public,anon,authenticated;

create function public.edit_match(target_match uuid,match_outcome text,match_winner uuid,sets jsonb,match_played_on date default current_date,match_retired_by uuid default null)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 result := public.lock_member_match(target_match);
 if auth.uid()<>result.submitted_by then raise exception 'Only the submitter can edit' using errcode='42501'; end if;
 if result.status<>'pending' or result.created_at<now()-interval '14 days' then raise exception 'Match is not pending or has expired' using errcode='22023'; end if;
 if not exists(select 1 from public.group_members where group_id=result.group_id and user_id=result.player_a and left_at is null)
    or not exists(select 1 from public.group_members where group_id=result.group_id and user_id=result.player_b and left_at is null) then
   raise exception 'Both players must be active group members' using errcode='42501';
 end if;
 perform public.validate_match_score(result.player_a,result.player_b,match_outcome,match_winner,sets,match_played_on,match_retired_by);
 update public.matches set outcome=match_outcome,winner=match_winner,played_on=match_played_on,retired_by=match_retired_by
 where id=target_match returning * into result;
 perform public.replace_match_sets(target_match,sets);
 return result;
end;
$$;

create function public.confirm_match(target_match uuid)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 result := public.lock_member_match(target_match);
 if auth.uid() not in (result.player_a,result.player_b) or auth.uid()=result.submitted_by then
   raise exception 'Only the opponent can confirm' using errcode='42501';
 end if;
 if result.status<>'pending' or result.created_at<now()-interval '14 days' then raise exception 'Match is not pending or has expired' using errcode='22023'; end if;
 if not exists(select 1 from public.group_members where group_id=result.group_id and user_id=result.submitted_by and left_at is null) then
   raise exception 'Both players must be active group members' using errcode='42501';
 end if;
 update public.matches set status='confirmed',confirmed_at=clock_timestamp() where id=target_match returning * into result;
 return result;
end;
$$;

create function public.reject_match(target_match uuid)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 result := public.lock_member_match(target_match);
 if auth.uid() not in (result.player_a,result.player_b) or auth.uid()=result.submitted_by then
   raise exception 'Only the opponent can reject' using errcode='42501';
 end if;
 if result.status<>'pending' or result.created_at<now()-interval '14 days' then raise exception 'Match is not pending or has expired' using errcode='22023'; end if;
 update public.matches set status='rejected' where id=target_match returning * into result;
 return result;
end;
$$;

create function public.withdraw_match(target_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 result := public.lock_member_match(target_match);
 if auth.uid()<>result.submitted_by then raise exception 'Only the submitter can withdraw' using errcode='42501'; end if;
 if result.status<>'pending' or result.created_at<now()-interval '14 days' then raise exception 'Match is not pending or has expired' using errcode='22023'; end if;
 delete from public.matches where id=target_match;
end;
$$;

create function public.void_match(target_match uuid)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 result := public.lock_member_match(target_match);
 if not public.is_group_organizer(result.group_id) then raise exception 'Only an organizer can void' using errcode='42501'; end if;
 if result.status<>'confirmed' or result.voided_at is not null then raise exception 'Only a nonvoid confirmed match can be voided' using errcode='22023'; end if;
 update public.matches set voided_at=clock_timestamp(),voided_by=auth.uid() where id=target_match returning * into result;
 return result;
end;
$$;
revoke all on function public.submit_match(uuid,uuid,text,uuid,jsonb,date,uuid),public.edit_match(uuid,text,uuid,jsonb,date,uuid),public.confirm_match(uuid),public.reject_match(uuid),public.withdraw_match(uuid),public.void_match(uuid) from public,anon,authenticated;
grant execute on function public.submit_match(uuid,uuid,text,uuid,jsonb,date,uuid),public.edit_match(uuid,text,uuid,jsonb,date,uuid),public.confirm_match(uuid),public.reject_match(uuid),public.withdraw_match(uuid),public.void_match(uuid) to authenticated,service_role;

create view public.group_standings with (security_invoker=true) as
with scored as (
 select m.*,coalesce(s.ga,0) as ga,coalesce(s.gb,0) as gb
 from public.matches m
 left join lateral (select sum(games_a) ga,sum(games_b) gb from public.match_sets where match_id=m.id) s on true
 where m.status='confirmed' and m.voided_at is null
), results as (
 select group_id,player_a user_id,winner=player_a won,ga games_won,gb games_lost from scored
 union all
 select group_id,player_b user_id,winner=player_b won,gb games_won,ga games_lost from scored
)
select gm.group_id,gm.user_id,p.display_name,gm.left_at is null as active,
 count(r.user_id) as matches_played,
 count(r.user_id) filter(where r.won) as wins,
 count(r.user_id) filter(where not r.won) as losses,
 coalesce(sum(r.games_won),0)::bigint as games_won,
 coalesce(sum(r.games_lost),0)::bigint as games_lost
from public.group_members gm join public.profiles p on p.id=gm.user_id
left join results r on r.group_id=gm.group_id and r.user_id=gm.user_id
 group by gm.group_id,gm.user_id,p.display_name,gm.left_at;
revoke all on public.group_standings from public,anon,authenticated;
grant select on public.group_standings to authenticated,service_role;
comment on view public.group_standings is 'Confirmed nonvoid singles results including inactive members. Walkovers count wins/losses but no games. Ratings are derived separately and exclude walkovers.';
comment on column public.matches.created_at is 'Pending expires when created_at < now() - interval 14 days. Edits never reset this timestamp.';
