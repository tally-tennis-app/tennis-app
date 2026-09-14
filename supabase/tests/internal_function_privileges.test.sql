-- Trigger functions run only through their owning triggers. They must not be
-- exposed as callable RPCs to API roles.

begin;

select plan(4);

select is(
  has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'),
  false,
  'anonymous users cannot call the new-user trigger function'
);

select is(
  has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  false,
  'authenticated users cannot call the new-user trigger function'
);

select is(
  has_function_privilege('anon', 'public.add_group_creator_as_organizer()', 'EXECUTE'),
  false,
  'anonymous users cannot call the group-creator trigger function'
);

select is(
  has_function_privilege('authenticated', 'public.add_group_creator_as_organizer()', 'EXECUTE'),
  false,
  'authenticated users cannot call the group-creator trigger function'
);

select * from finish();

rollback;
