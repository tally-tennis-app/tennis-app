-- Profile details: an avatar, a hometown, and a bio.
--
-- The existing policies already cover these columns. profiles_update_own limits
-- writes to your own row and profiles_select_self_or_group_peer
-- (20260907023806_groups.sql) already shows a profile to players who share a
-- group, which is exactly the audience for a hometown and a bio.

alter table public.profiles
  add column hometown text
    constraint profiles_hometown_length
      check (hometown is null or char_length(trim(hometown)) between 1 and 60),
  add column bio text
    constraint profiles_bio_length
      check (bio is null or char_length(trim(bio)) between 1 and 280),
  -- Storage policies confine a write to your own prefix; this keeps a row from
  -- pointing at someone else's uploaded object.
  add column avatar_path text
    constraint profiles_avatar_path_owned
      check (avatar_path is null or avatar_path like id::text || '/%');

comment on column public.profiles.hometown is 'Optional free text, up to 60 characters.';
comment on column public.profiles.bio is 'Optional free text, up to 280 characters.';
comment on column public.profiles.avatar_path is
  'Object path inside the private avatars bucket, always under the profile id. Served as a short-lived signed URL.';

-- A private bucket: an avatar is visible to group peers, not to the internet.
-- The limit and the type list are the upload trust boundary, enforced by
-- Storage itself rather than by the form.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Write only inside your own folder.
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Read your own, or a player you share a group with. The folder is compared as
-- text through profiles rather than cast to uuid, so a malformed path can never
-- raise inside a policy.
create policy avatars_select_peer on storage.objects for select to authenticated
  using (bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and public.shares_group_with(p.id))));
