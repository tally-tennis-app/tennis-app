-- These predicates also authorize mutations after a row-lock wait. STABLE SQL
-- functions retain the caller's pre-wait snapshot; VOLATILE takes a fresh
-- snapshot and observes a committed removal/demotion. At pilot scale the extra
-- predicate reads are preferable to stale authorization. RLS stays enabled.
alter function public.is_group_member(uuid) volatile;
alter function public.is_group_organizer(uuid) volatile;
alter function public.active_organizer_count(uuid) volatile;

-- Confirmation order must also be commit order across groups: global Elo can
-- share players between any two groups. One transaction-held lock is a deliberate
-- pilot-volume tradeoff. Acquire it before any group/match lock, then assign a
-- strictly increasing timestamp (including ties or a wall clock adjustment).


create or replace function public.confirm_match(target_match uuid)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 perform pg_advisory_xact_lock(20260914,1);
 result := public.lock_member_match(target_match);
 if auth.uid() not in (result.player_a,result.player_b) or auth.uid()=result.submitted_by then
   raise exception 'Only the opponent can confirm' using errcode='42501';
 end if;
 if result.status<>'pending' or result.created_at<now()-interval '14 days' then raise exception 'Match is not pending or has expired' using errcode='22023'; end if;
 if not exists(select 1 from public.group_members where group_id=result.group_id and user_id=result.submitted_by and left_at is null) then
   raise exception 'Both players must be active group members' using errcode='42501';
 end if;
 update public.matches set status='confirmed',confirmed_at=greatest(clock_timestamp(),
   (select max(m.confirmed_at)+interval '1 microsecond' from public.matches m)) where id=target_match returning * into result;
 return result;
end;
$$;


-- The membership trigger remains a defense for administrative writes, but a
-- BEFORE ROW trigger runs after an RPC's authorization/count reads. Lock at RPC
-- entry so those decisions see the previous transaction's committed mutation.


create or replace function public.leave_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role text;
begin
  perform 1 from public.groups where id = target_group for update;
  select role into actor_role
  from public.group_members
  where group_id = target_group and user_id = actor and left_at is null;

  if actor_role is null then
    raise exception 'You are not a member of that group' using errcode = '42501';
  end if;

  -- Decision D19: a group always keeps at least one organizer.
  if actor_role = 'organizer'
     and public.active_organizer_count(target_group) = 1 then
    raise exception 'Transfer the organizer role before leaving'
      using errcode = '23514';
  end if;

  update public.group_members
  set left_at = now()
  where group_id = target_group and user_id = actor;
end;
$$;

create or replace function public.remove_group_member(target_group uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
begin
  perform 1 from public.groups where id = target_group for update;
  if not public.is_group_organizer(target_group) then
    raise exception 'Only an organizer can remove a member' using errcode = '42501';
  end if;

  select role into target_role
  from public.group_members
  where group_id = target_group and user_id = target_user and left_at is null;

  if target_role is null then
    raise exception 'That person is not an active member' using errcode = '42501';
  end if;

  if target_role = 'organizer'
     and public.active_organizer_count(target_group) = 1 then
    raise exception 'A group must keep at least one organizer'
      using errcode = '23514';
  end if;

  update public.group_members
  set left_at = now(), removed_by = (select auth.uid())
  where group_id = target_group and user_id = target_user;
end;
$$;

create or replace function public.restore_group_member(target_group uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.groups where id = target_group for update;
  if not public.is_group_organizer(target_group) then
    raise exception 'Only an organizer can restore a member' using errcode = '42501';
  end if;

  update public.group_members
  set left_at = null, removed_by = null, role = 'player'
  where group_id = target_group and user_id = target_user and left_at is not null;

  if not found then
    raise exception 'That person is not a former member of this group'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.set_group_member_role(
  target_group uuid,
  target_user uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
begin
  perform 1 from public.groups where id = target_group for update;
  if new_role not in ('organizer', 'player') then
    raise exception 'Unknown role %', new_role using errcode = '22023';
  end if;

  if not public.is_group_organizer(target_group) then
    raise exception 'Only an organizer can change roles' using errcode = '42501';
  end if;

  select role into target_role
  from public.group_members
  where group_id = target_group and user_id = target_user and left_at is null;

  if target_role is null then
    raise exception 'That person is not an active member' using errcode = '42501';
  end if;

  if target_role = 'organizer'
     and new_role = 'player'
     and public.active_organizer_count(target_group) = 1 then
    raise exception 'A group must keep at least one organizer'
      using errcode = '23514';
  end if;

  update public.group_members
  set role = new_role
  where group_id = target_group and user_id = target_user;
end;
$$;

create or replace function public.rotate_group_invite(target_group uuid, valid_days integer default 30)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh_code text;
begin
  perform 1 from public.groups where id = target_group for update;
  if not public.is_group_organizer(target_group) then
    raise exception 'Only an organizer can rotate the invite code'
      using errcode = '42501';
  end if;

  if valid_days < 1 or valid_days > 365 then
    raise exception 'Invite validity must be between 1 and 365 days'
      using errcode = '22023';
  end if;

  fresh_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));

  update public.groups
  set invite_code = fresh_code,
      invite_expires_at = now() + make_interval(days => valid_days)
  where id = target_group;

  return fresh_code;
end;
$$;

create or replace function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_group uuid;
  existing_left_at timestamptz;
  existing_removed_by uuid;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Looked up inside the function because a non-member cannot select from
  -- groups. This is also why the invite code cannot be used to enumerate
  -- groups: a wrong code is indistinguishable from an expired one.
  select id into target_group
  from public.groups
  where invite_code = upper(trim(code))
    and invite_expires_at > now()
  for update;

  if target_group is null then
    raise exception 'That invite code is not valid' using errcode = '22023';
  end if;

  select left_at, removed_by into existing_left_at, existing_removed_by
  from public.group_members
  where group_id = target_group and user_id = actor;

  if found then
    if existing_left_at is null then
      return target_group;
    end if;

    -- Removal is sticky. Otherwise an organizer removing someone achieves
    -- nothing: the code they already know lets them straight back in.
    if existing_removed_by is not null then
      raise exception 'An organizer removed you from that group'
        using errcode = '42501';
    end if;

    -- Someone who left of their own accord may return, keeping their original
    -- joined_at and history, as a player whatever role they held before.
    update public.group_members
    set left_at = null, role = 'player'
    where group_id = target_group and user_id = actor;
  else
    insert into public.group_members (group_id, user_id, role)
    values (target_group, actor, 'player');
  end if;

  return target_group;
end;
$$;


-- CREATE OR REPLACE preserves existing owner, fixed search_path and grants.
-- Restate the exposed boundary so the migration is independently reviewable.
revoke all on function public.confirm_match(uuid),public.leave_group(uuid),
 public.remove_group_member(uuid,uuid),public.restore_group_member(uuid,uuid),
 public.set_group_member_role(uuid,uuid,text),public.rotate_group_invite(uuid,integer),
 public.join_group_by_code(text) from public,anon;
grant execute on function public.confirm_match(uuid),public.leave_group(uuid),
 public.remove_group_member(uuid,uuid),public.restore_group_member(uuid,uuid),
 public.set_group_member_role(uuid,uuid,text),public.rotate_group_invite(uuid,integer),
 public.join_group_by_code(text) to authenticated,service_role;
