-- Milestone B: groups and membership.
--
-- This is the security spine. Every later table inherits the "can this user see
-- this group" predicate established here, so read the policy notes before
-- adding tables that reference a group.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  invite_expires_at timestamptz not null default (now() + interval '30 days'),
  -- Nullable and set null on delete: a group must survive its creator deleting
  -- their account. Cascading here would destroy the whole group's history.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(trim(name)) between 1 and 60)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player'
    check (role in ('organizer', 'player')),
  joined_at timestamptz not null default now(),
  -- Decision D18: a departed member keeps their row and stays in standings.
  -- Removing the row would silently change every remaining member's rating.
  left_at timestamptz,
  -- Distinguishes "an organizer removed me" from "I left". Without it a removed
  -- member simply rejoins with the invite code they already know, which makes
  -- removal meaningless. Null while active, and null for a voluntary departure.
  removed_by uuid references public.profiles (id) on delete set null,
  primary key (group_id, user_id),
  constraint group_members_removed_implies_left
    check (removed_by is null or left_at is not null)
);

create index group_members_user_id_idx on public.group_members (user_id);

comment on column public.group_members.left_at is
  'Null means active. A departed member keeps their row so their results stay in the group history.';

comment on column public.group_members.removed_by is
  'Set when an organizer removed this member. Such a member cannot rejoin with the invite code; an organizer must restore them.';

-- --------------------------------------------------------------------------
-- Membership predicates
--
-- These are SECURITY DEFINER on purpose. A policy on group_members that asks
-- "is the caller a member of this group" has to read group_members, which
-- re-triggers the same policy and recurses until Postgres gives up. Running as
-- the owner bypasses RLS inside the function and breaks that cycle.
--
-- They are also the single definition of "member", so every later table can
-- reuse them instead of copying a subquery into each policy.
-- --------------------------------------------------------------------------

create function public.is_group_member(target_group uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group
      and user_id = (select auth.uid())
      and left_at is null
  );
$$;

create function public.is_group_organizer(target_group uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group
      and user_id = (select auth.uid())
      and left_at is null
      and role = 'organizer'
  );
$$;

-- Departed members are deliberately still visible: standings show their past
-- results, so their display name must remain readable to the group.
create function public.shares_group_with(other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and mine.left_at is null
      and theirs.user_id = other_user
  );
$$;

create function public.active_organizer_count(target_group uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.group_members
  where group_id = target_group
    and left_at is null
    and role = 'organizer';
$$;

-- --------------------------------------------------------------------------
-- Row Level Security
--
-- Reads are policy-driven. There is deliberately no INSERT policy on groups
-- either: creation goes through create_group(), so the invite code is always
-- generated server-side and a client cannot squat on a guessable one.
--
-- Every membership mutation goes through a function below instead of an UPDATE
-- policy: the rules ("only organizers", "never
-- remove the last organizer", "a player cannot promote themselves") are
-- conditional on the new row's role, which is awkward and easy to get wrong in
-- a WITH CHECK clause. No UPDATE or DELETE policy exists on group_members, so
-- a crafted direct write has no path at all.
-- --------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "groups_select_member"
  on public.groups
  for select
  to authenticated
  using (public.is_group_member(id));

create policy "group_members_select_member"
  on public.group_members
  for select
  to authenticated
  using (public.is_group_member(group_id));

-- Widened from own-row-only now that a group predicate exists to scope it: a
-- player must be able to see an opponent's display name.
drop policy "profiles_select_own" on public.profiles;

create policy "profiles_select_self_or_group_peer"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.shares_group_with(id)
  );

-- --------------------------------------------------------------------------
-- Membership mutations
-- --------------------------------------------------------------------------

create function public.add_group_creator_as_organizer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'organizer');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row
  execute function public.add_group_creator_as_organizer();

create function public.join_group_by_code(code text)
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
    and invite_expires_at > now();

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

create function public.leave_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role text;
begin
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

create function public.remove_group_member(target_group uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
begin
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

-- The counterpart to removal. Without it an accidental Remove is unfixable,
-- since a removed member can no longer rejoin with the code.
create function public.restore_group_member(target_group uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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

-- Covers promotion, demotion, and handover: promote the successor, then demote
-- yourself. Kept as one function so the last-organizer guard lives in one place.
create function public.set_group_member_role(
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

-- Decision D17: the organizer regenerates the code to revoke or extend it.
-- Regenerating is the only revocation mechanism, so it also resets the clock.
create function public.rotate_group_invite(target_group uuid, valid_days integer default 30)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh_code text;
begin
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

-- The code is generated server-side so a client cannot choose a guessable one.
create function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_group uuid;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.groups (name, invite_code, created_by)
  values (
    trim(group_name),
    upper(substr(md5(gen_random_uuid()::text), 1, 8)),
    actor
  )
  returning id into new_group;

  return new_group;
end;
$$;

-- Every function above is SECURITY DEFINER, so execution is granted
-- deliberately rather than left at the PUBLIC default.
revoke execute on function
  public.is_group_member(uuid),
  public.is_group_organizer(uuid),
  public.shares_group_with(uuid),
  public.active_organizer_count(uuid),
  public.join_group_by_code(text),
  public.leave_group(uuid),
  public.remove_group_member(uuid, uuid),
  public.restore_group_member(uuid, uuid),
  public.set_group_member_role(uuid, uuid, text),
  public.rotate_group_invite(uuid, integer),
  public.create_group(text)
from public, anon;

grant execute on function
  public.is_group_member(uuid),
  public.is_group_organizer(uuid),
  public.shares_group_with(uuid),
  public.active_organizer_count(uuid),
  public.join_group_by_code(text),
  public.leave_group(uuid),
  public.remove_group_member(uuid, uuid),
  public.restore_group_member(uuid, uuid),
  public.set_group_member_role(uuid, uuid, text),
  public.rotate_group_invite(uuid, integer),
  public.create_group(text)
to authenticated, service_role;
