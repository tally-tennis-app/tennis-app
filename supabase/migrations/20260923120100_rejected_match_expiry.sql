-- A rejected match disappears five days after it was rejected.
--
-- Computed from a timestamp at read time, the same shape as the fourteen-day
-- pending rule, so there is no scheduled job to own. The row is not deleted:
-- withdrawal is the only path that removes a match, and a rejection the
-- submitter has already seen is not worth a destructive cleanup.
--
-- The filter lives in the select policies so that the list, the detail page,
-- the standings view, and every future reader inherit it from one place. The
-- rating fold is unaffected: it runs as the owner and already reads only
-- confirmed matches.

alter table public.matches add column rejected_at timestamptz;

-- Existing rejections have no timestamp, so age them from submission. That is
-- the earliest defensible instant and keeps the constraint below satisfiable.
update public.matches set rejected_at = created_at where status = 'rejected';

alter table public.matches
  add constraint matches_rejected_at_matches_status
    check ((status = 'rejected') = (rejected_at is not null));

comment on column public.matches.rejected_at is
  'When the opponent rejected the submission. The match stops being visible five days later.';

create function public.match_is_visible(match_status text, match_rejected_at timestamptz)
returns boolean language sql stable set search_path = '' as $$
 select match_status <> 'rejected'
   or match_rejected_at > now() - interval '5 days'
$$;
comment on function public.match_is_visible(text, timestamptz) is
  'False once a rejection is more than five days old. Called from the match select policies, so the querying role needs execute.';
revoke all on function public.match_is_visible(text, timestamptz) from public, anon;
grant execute on function public.match_is_visible(text, timestamptz) to authenticated, service_role;

create or replace function public.reject_match(target_match uuid)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare result public.matches;
begin
 result := public.lock_member_match(target_match);
 if auth.uid() not in (result.player_a,result.player_b) or auth.uid()=result.submitted_by then
   raise exception 'Only the opponent can reject' using errcode='42501';
 end if;
 if result.status<>'pending' or result.created_at<now()-interval '14 days' then raise exception 'Match is not pending or has expired' using errcode='22023'; end if;
 update public.matches set status='rejected',rejected_at=clock_timestamp() where id=target_match returning * into result;
 return result;
end;
$$;

-- Both policies gain the same predicate: a hidden match must not leak its sets.
drop policy matches_select_member on public.matches;
create policy matches_select_member on public.matches for select to authenticated
 using (public.is_group_member(group_id) and public.match_is_visible(status,rejected_at));

drop policy match_sets_select_member on public.match_sets;
create policy match_sets_select_member on public.match_sets for select to authenticated
 using (exists(select 1 from public.matches m
   where m.id=match_id and public.is_group_member(m.group_id)
     and public.match_is_visible(m.status,m.rejected_at)));
