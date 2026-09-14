-- The private fold sees the full ledger; public wrappers filter the outputs.
-- Rating values exist only during query execution, never in a stored column.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create function private.rating_parameters()
returns table(starting_rating double precision,k double precision,mov_m double precision)
language sql immutable set search_path='' as $$ select 1500::double precision,32::double precision,0.25::double precision $$;
revoke all on function private.rating_parameters() from public,anon,authenticated;
create function private.rating_events(p_group_id uuid default null)
returns table(match_id uuid,group_id uuid,player_id uuid,confirmed_at timestamptz,
 rating_before double precision,rating_after double precision,delta double precision,matches_played bigint)
language plpgsql stable set search_path='' as $$
declare
 parameters record;
 ratings jsonb := '{}'::jsonb; counts jsonb := '{}'::jsonb;
 m record; ra double precision; rb double precision; expected double precision;
 share double precision; multiplier double precision; change double precision;
 ca bigint; cb bigint;
begin
 select * into parameters from private.rating_parameters();
 for m in
  select x.*,coalesce(s.ga,0) ga,coalesce(s.gb,0) gb from public.matches x
  left join lateral(select sum(ms.games_a) ga,sum(ms.games_b) gb from public.match_sets ms where ms.match_id=x.id) s on true
  where x.status='confirmed' and x.voided_at is null and x.outcome<>'walkover'
    and (p_group_id is null or x.group_id=p_group_id)
  order by x.confirmed_at,x.id
 loop
  ra:=coalesce((ratings->>m.player_a::text)::double precision,parameters.starting_rating);
  rb:=coalesce((ratings->>m.player_b::text)::double precision,parameters.starting_rating);
  ca:=coalesce((counts->>m.player_a::text)::bigint,0)+1;
  cb:=coalesce((counts->>m.player_b::text)::bigint,0)+1;
  expected:=1/(1+power(10::double precision,(rb-ra)/400));
  share:=case when m.ga+m.gb=0 then 0.5 else (case when m.winner=m.player_a then m.ga else m.gb end)::double precision/(m.ga+m.gb) end;
  multiplier:=1+parameters.mov_m*(greatest(0.5,least(1.0,share))-0.5)*2;
  change:=parameters.k*multiplier*((case when m.winner=m.player_a then 1 else 0 end)-expected);
  ratings:=ratings||jsonb_build_object(m.player_a::text,ra+change,m.player_b::text,rb-change);
  counts:=counts||jsonb_build_object(m.player_a::text,ca,m.player_b::text,cb);
  match_id:=m.id; group_id:=m.group_id; confirmed_at:=m.confirmed_at;
  player_id:=m.player_a; rating_before:=ra; rating_after:=ra+change; delta:=change; matches_played:=ca; return next;
  player_id:=m.player_b; rating_before:=rb; rating_after:=rb-change; delta:=-change; matches_played:=cb; return next;
 end loop;
end;
$$;
revoke all on function private.rating_events(uuid) from public,anon,authenticated;

create function public.get_ratings(p_group_id uuid default null)
returns table(player_id uuid,display_name text,rating double precision,matches_played bigint,active boolean)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.profiles p where p.id=actor) then
  raise exception 'Sign in to see ratings' using errcode='42501';
 end if;
 if p_group_id is not null and not public.is_group_member(p_group_id) then
  raise exception 'Group is not available' using errcode='42501';
 end if;
 return query
 with latest as (
  select distinct on(e.player_id) e.player_id,e.rating_after,e.matches_played
  from private.rating_events(p_group_id) e order by e.player_id,e.confirmed_at desc,e.match_id desc
 ), visible as (
  select p.id,p.display_name,
   case when p_group_id is not null then exists(select 1 from public.group_members gm where gm.group_id=p_group_id and gm.user_id=p.id and gm.left_at is null)
    else p.id=actor or exists(select 1 from public.group_members gm join public.group_members mine on mine.group_id=gm.group_id where gm.user_id=p.id and mine.user_id=actor and mine.left_at is null and gm.left_at is null) end active
  from public.profiles p
  where (p_group_id is not null and exists(select 1 from public.group_members gm where gm.group_id=p_group_id and gm.user_id=p.id))
   or (p_group_id is null and (p.id=actor or exists(select 1 from public.group_members gm join public.group_members mine on mine.group_id=gm.group_id where gm.user_id=p.id and mine.user_id=actor and mine.left_at is null)))
 )
 select v.id,v.display_name,coalesce(l.rating_after,(select c.starting_rating from private.rating_parameters() c)),coalesce(l.matches_played,0::bigint),v.active
 from visible v left join latest l on l.player_id=v.id
 order by coalesce(l.rating_after,(select c.starting_rating from private.rating_parameters() c)) desc,v.display_name,v.id;
end;
$$;

create function public.get_rating_history(p_player_id uuid,p_group_id uuid default null)
returns table(match_id uuid,group_id uuid,player_id uuid,confirmed_at timestamptz,
 rating_before double precision,rating_after double precision,delta double precision)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to see ratings' using errcode='42501'; end if;
 if not exists(select 1 from public.get_ratings(p_group_id) r where r.player_id=p_player_id) then
  raise exception 'Player is not available' using errcode='42501';
 end if;
 return query select e.match_id,e.group_id,e.player_id,e.confirmed_at,e.rating_before,e.rating_after,e.delta
 from private.rating_events(p_group_id) e
 where e.player_id=p_player_id and public.is_group_member(e.group_id)
 order by e.confirmed_at desc,e.match_id desc;
end;
$$;
revoke all on function public.get_ratings(uuid),public.get_rating_history(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_ratings(uuid),public.get_rating_history(uuid,uuid) to authenticated,service_role;
comment on function public.get_ratings(uuid) is 'True global or group Elo derived on demand. Global player visibility is self/shared groups; no hidden match rows are returned.';
comment on function public.get_rating_history(uuid,uuid) is 'Derived rating events for authorized players, filtered to caller-visible groups even in global mode.';
