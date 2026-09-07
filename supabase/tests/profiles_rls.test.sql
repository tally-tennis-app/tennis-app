-- Row Level Security tests for public.profiles.
--
-- Run with `npm run db:test` (or `supabase test db`), which executes these
-- against a real Postgres with the migrations applied. Asserting as an
-- unprivileged `authenticated` role is the point: a query that succeeds as the
-- table owner proves nothing about the policies.

begin;

select plan(9);

-- Two users. The on_auth_user_created trigger should give each a profile.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ada@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Ada"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bo@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{}'::jsonb);

-- The trigger, seen as the table owner.
select is(
  (select count(*)::int from public.profiles),
  2,
  'the trigger creates one profile per auth user'
);

select is(
  (select display_name from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'Ada',
  'display_name comes from raw_user_meta_data when supplied'
);

select is(
  (select display_name from public.profiles
   where id = '22222222-2222-2222-2222-222222222222'),
  'bo',
  'display_name falls back to the email local part'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'row level security is enabled on profiles'
);

-- Act as Ada.
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles),
  1,
  'an authenticated user sees exactly one profile row'
);

select is(
  (select count(*)::int from public.profiles
   where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'a user cannot read another user''s profile'
);

update public.profiles set display_name = 'Ada L.'
where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select display_name from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'Ada L.',
  'a user can update their own display name'
);

-- Blocked by the policy predicate, so this matches no rows rather than erroring.
update public.profiles set display_name = 'hijacked'
where id = '22222222-2222-2222-2222-222222222222';

select is(
  (select count(*)::int from public.profiles where display_name = 'hijacked'),
  0,
  'a user cannot update another user''s profile'
);

-- Act as a signed-out visitor. `set local role` is permitted here because the
-- privilege check is against the session role, not the current one.
set local role anon;
-- Not `to null`, which is a syntax error for a custom parameter. auth.uid()
-- treats the empty string as no claims.
set local request.jwt.claims to '';

select is(
  (select count(*)::int from public.profiles),
  0,
  'an anonymous visitor sees no profiles at all'
);

select * from finish();

rollback;
