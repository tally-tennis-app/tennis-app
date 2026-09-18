-- Reasons for rejecting and voiding a match (nextsteps.md Segment 5: "a
-- reasoned void flow"). Additive only: the existing reject_match(uuid) and
-- void_match(uuid) keep their signatures, grants, and checks, and the new
-- overloads delegate to them, so authorization lives in one place.

alter table public.matches
  add column rejection_reason text
    check (rejection_reason is null or char_length(rejection_reason) <= 200),
  add column void_reason text
    check (void_reason is null or char_length(trim(void_reason)) between 1 and 200);

comment on column public.matches.rejection_reason is
  'Optional note from the opponent explaining a rejection. Shown to the submitter.';
comment on column public.matches.void_reason is
  'Required when an organizer voids through void_match(uuid, text); shown to the group.';

create function public.reject_match(target_match uuid, reason text)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.matches;
begin
  result := public.reject_match(target_match);
  update public.matches
  set rejection_reason = nullif(left(trim(reason), 200), '')
  where id = target_match
  returning * into result;
  return result;
end;
$$;

create function public.void_match(target_match uuid, reason text)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.matches;
begin
  if reason is null or char_length(trim(reason)) = 0 then
    raise exception 'Give a reason for voiding the match' using errcode = '22023';
  end if;
  result := public.void_match(target_match);
  update public.matches
  set void_reason = left(trim(reason), 200)
  where id = target_match
  returning * into result;
  return result;
end;
$$;

revoke all on function public.reject_match(uuid, text), public.void_match(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reject_match(uuid, text), public.void_match(uuid, text)
  to authenticated, service_role;
