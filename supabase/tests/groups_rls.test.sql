-- Row Level Security and membership rules for groups.
--
-- Every assertion that matters runs as an unprivileged `authenticated` role
-- with real JWT claims. A query that succeeds as the table owner proves
-- nothing: the owner bypasses RLS.

begin;

select plan(26);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ada@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Ada"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bo@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Bo"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cal@example.com', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name": "Cal"}'::jsonb);

-- ---------------------------------------------------------------- Ada's group

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_group('Tuesday Ladder') $$,
  'an authenticated user can create a group'
);

select is(
  (select count(*)::int from public.groups),
  1,
  'the creator can see the group they just made'
);

select is(
  (select role from public.group_members
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'organizer',
  'the trigger makes the creator an organizer'
);

select isnt(
  (select invite_code from public.groups limit 1),
  null,
  'the group gets a server-generated invite code'
);

reset role;
create temp table ctx as
  select id as g1, invite_code as code1 from public.groups limit 1;
-- The temp table is owned by the session role, so the authenticated role it is
-- read back as needs an explicit grant.
grant select on ctx to public;

-- ------------------------------------------------- Cal is in a different group

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_group('Sunday Doubles') $$,
  'a second user can create their own group'
);

-- The acceptance criterion: two accounts in different groups see nothing of
-- each other, proven by authenticating as each and asserting empty results.
select is(
  (select count(*)::int from public.groups where id = (select g1 from ctx)),
  0,
  'a non-member cannot see another group'
);

select is(
  (select count(*)::int from public.group_members
   where group_id = (select g1 from ctx)),
  0,
  'a non-member cannot see another group''s membership rows'
);

select is(
  (select count(*)::int from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'a user in an unrelated group cannot read another player''s profile'
);

select throws_ok(
  format('select public.remove_group_member(%L, %L)',
         (select g1 from ctx), '11111111-1111-1111-1111-111111111111'),
  '42501',
  'Only an organizer can remove a member',
  'an outsider cannot remove a member of a group they are not in'
);

-- ------------------------------------------------------------ Bo joins by code

set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ select public.join_group_by_code('NOPE1234') $$,
  '22023',
  'That invite code is not valid',
  'an unknown invite code is refused'
);

select lives_ok(
  format('select public.join_group_by_code(%L)', (select code1 from ctx)),
  'a valid invite code joins the group'
);

select is(
  (select role from public.group_members
   where group_id = (select g1 from ctx)
     and user_id = '22222222-2222-2222-2222-222222222222'),
  'player',
  'someone joining by code arrives as a player, not an organizer'
);

select is(
  (select count(*)::int from public.group_members
   where group_id = (select g1 from ctx)),
  2,
  'a member sees the whole roster'
);

select is(
  (select display_name from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'Ada',
  'a member can read a groupmate''s display name'
);

-- A player has no route to privilege, by policy and by function.
select throws_ok(
  format('select public.set_group_member_role(%L, %L, %L)',
         (select g1 from ctx), '22222222-2222-2222-2222-222222222222', 'organizer'),
  '42501',
  'Only an organizer can change roles',
  'a player cannot promote themselves'
);

select throws_ok(
  format('select public.remove_group_member(%L, %L)',
         (select g1 from ctx), '11111111-1111-1111-1111-111111111111'),
  '42501',
  'Only an organizer can remove a member',
  'a player cannot remove the organizer'
);

-- There is no UPDATE policy on group_members, so a direct write matches no
-- rows rather than erroring. This is the "including by calling the API
-- directly" half of the acceptance criterion.
update public.group_members set role = 'organizer'
where group_id = (select g1 from ctx)
  and user_id = '22222222-2222-2222-2222-222222222222';

select is(
  (select role from public.group_members
   where group_id = (select g1 from ctx)
     and user_id = '22222222-2222-2222-2222-222222222222'),
  'player',
  'a direct update cannot change a member''s role'
);

-- --------------------------------------------------------- Invite code expiry

reset role;
update public.groups set invite_expires_at = now() - interval '1 day'
where id = (select g1 from ctx);

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select throws_ok(
  format('select public.join_group_by_code(%L)', (select code1 from ctx)),
  '22023',
  'That invite code is not valid',
  'an expired invite code is refused'
);

-- ------------------------------------------------------- Rotation revokes it

set local request.jwt.claims to
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  format('select public.rotate_group_invite(%L)', (select g1 from ctx)),
  '42501',
  'Only an organizer can rotate the invite code',
  'a player cannot rotate the invite code'
);

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  format('select public.rotate_group_invite(%L)', (select g1 from ctx)),
  'an organizer can rotate the invite code'
);

set local request.jwt.claims to
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select throws_ok(
  format('select public.join_group_by_code(%L)', (select code1 from ctx)),
  '22023',
  'That invite code is not valid',
  'a rotated invite code no longer works'
);

-- ------------------------------------------------------- Last organizer rules

set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  format('select public.leave_group(%L)', (select g1 from ctx)),
  '23514',
  'Transfer the organizer role before leaving',
  'the last organizer cannot leave without transferring'
);

select lives_ok(
  format('select public.set_group_member_role(%L, %L, %L)',
         (select g1 from ctx), '22222222-2222-2222-2222-222222222222', 'organizer'),
  'an organizer can promote another member'
);

select lives_ok(
  format('select public.leave_group(%L)', (select g1 from ctx)),
  'the outgoing organizer can leave once a successor exists'
);

-- Decision D18: the row stays so the group history survives.
reset role;
select isnt(
  (select left_at from public.group_members
   where group_id = (select g1 from ctx)
     and user_id = '11111111-1111-1111-1111-111111111111'),
  null,
  'a departed member keeps their row, marked inactive'
);

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.groups where id = (select g1 from ctx)),
  0,
  'a departed member loses read access to the group'
);

select * from finish();

rollback;
