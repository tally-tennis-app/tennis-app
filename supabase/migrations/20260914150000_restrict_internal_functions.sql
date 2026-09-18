-- Trigger functions are invoked by Postgres and are not part of the public
-- RPC surface. Function creation grants EXECUTE to PUBLIC by default, so
-- remove that implicit access explicitly.
revoke all on function public.handle_new_user()
from public, anon, authenticated;

revoke all on function public.add_group_creator_as_organizer()
from public, anon, authenticated;
