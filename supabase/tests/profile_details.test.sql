-- Profile details and the avatars bucket (20260923120200_profile_details.sql).
-- The length limits, the owned-path constraint, group-peer visibility, and the
-- storage policies are all checked as unprivileged users.

begin;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', name || '@example.com', 'x', now(), now(), now(),
       '{}'::jsonb, jsonb_build_object('display_name', name)
from (values
  ('11111111-1111-1111-1111-111111111111', 'Ada'),
  ('22222222-2222-2222-2222-222222222222', 'Bo'),
  ('33333333-3333-3333-3333-333333333333', 'Cal')
) as people (id, name);

create function pg_temp.as_user(who text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
$$;

-- Ada and Bo share a group; Cal is a stranger.
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.create_group('Tuesday Ladder');
reset role;
create temp table ctx as select id as g, invite_code as code from public.groups;
grant select on ctx to public;
set local role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.join_group_by_code((select code from ctx));

-- Ada fills in her own profile.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok($$
  update public.profiles
  set hometown = 'Wellington', bio = 'Lefty. Slice backhand.',
      avatar_path = '11111111-1111-1111-1111-111111111111/avatar.jpg'
  where id = '11111111-1111-1111-1111-111111111111'
$$, 'a player fills in their own profile');

select throws_ok($$
  update public.profiles set hometown = repeat('x', 61)
  where id = '11111111-1111-1111-1111-111111111111'
$$, '23514', null, 'an over-long hometown is rejected');

select throws_ok($$
  update public.profiles set bio = repeat('x', 281)
  where id = '11111111-1111-1111-1111-111111111111'
$$, '23514', null, 'an over-long bio is rejected');

select throws_ok($$
  update public.profiles set hometown = '   '
  where id = '11111111-1111-1111-1111-111111111111'
$$, '23514', null, 'a blank hometown must be null, not empty');

-- The avatar path must live under the profile's own id.
select throws_ok($$
  update public.profiles
  set avatar_path = '22222222-2222-2222-2222-222222222222/avatar.jpg'
  where id = '11111111-1111-1111-1111-111111111111'
$$, '23514', null, 'a profile cannot point at another player''s avatar');

-- A group peer reads the details; a stranger sees no row at all.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select hometown from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Wellington', 'a group peer reads a hometown');
select is((select bio from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Lefty. Slice backhand.', 'a group peer reads a bio');

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  0, 'a stranger sees no profile row');

-- Storage: the bucket is private, and a write is confined to your own prefix.
reset role;
select is((select public from storage.buckets where id = 'avatars'), false,
  'the avatars bucket is not public');

set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok($$
  insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '11111111-1111-1111-1111-111111111111/avatar.jpg',
          '11111111-1111-1111-1111-111111111111')
$$, 'a player uploads inside their own prefix');

select throws_ok($$
  insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '22222222-2222-2222-2222-222222222222/avatar.jpg',
          '11111111-1111-1111-1111-111111111111')
$$, '42501', null, 'a player cannot write into another prefix');

-- A peer may read the object so the server can sign a URL for it; a stranger
-- may not.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from storage.objects
  where name = '11111111-1111-1111-1111-111111111111/avatar.jpg'), 1,
  'a group peer can read a shared player''s avatar object');

select * from finish();
rollback;
