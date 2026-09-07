-- Milestone A: profiles.
--
-- One row per authenticated user, created by trigger so the application never
-- has to insert it. See docs/product-questions.md for the auth decisions.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (char_length(trim(display_name)) between 1 and 50)
);

comment on table public.profiles is
  'Public profile for an authenticated user. Created by trigger on auth.users insert.';

alter table public.profiles enable row level security;

-- A user reads and updates only their own row.
--
-- Milestone B widens the select policy to group members: a player must be able
-- to see the display name of an opponent in a shared group. It stays own-row
-- only until that group predicate exists to scope it.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert or delete policy. Rows arrive by trigger and leave by cascade when
-- the auth user is deleted, so no client ever writes here directly.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates a profile row for a new auth user, falling back to the email local part when no display name was supplied.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
