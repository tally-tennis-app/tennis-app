import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { asUuid } from "@/src/lib/forms";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type PlayerProfile = {
  id: string;
  name: string;
  memberSince: string;
  hometown: string | null;
  bio: string | null;
  /** Short-lived signed URL, or null when no picture was uploaded. */
  avatarUrl: string | null;
};

/** How long a signed avatar URL stays valid. Long enough for one page view. */
const AVATAR_URL_SECONDS = 600;

/**
 * Signs an avatar path so the browser can fetch it from the private bucket.
 * Storage policies still apply: this only succeeds for your own picture or a
 * player you share a group with. A failure is not worth an error page, so an
 * unsigned avatar simply falls back to initials.
 */
export async function signAvatar(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, AVATAR_URL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Signed avatar URLs for many players at once, keyed by player id.
 *
 * One profiles query and one signing call however many rows are on the page:
 * a roster or a standings table would otherwise sign a URL per row. Players
 * with no picture, or whose object cannot be signed, are simply absent from
 * the map and fall back to initials.
 */
export async function avatarUrlsFor(
  playerIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(playerIds)].filter(Boolean);
  if (ids.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, avatar_path")
    .in("id", ids);

  const withPicture = (data ?? []).flatMap((row) =>
    row.avatar_path ? [{ id: row.id, path: row.avatar_path }] : [],
  );
  if (withPicture.length === 0) return new Map();

  const { data: signed } = await supabase.storage
    .from("avatars")
    .createSignedUrls(
      withPicture.map((row) => row.path),
      AVATAR_URL_SECONDS,
    );

  const urlByPath = new Map(
    (signed ?? []).flatMap((item) =>
      item.signedUrl && item.path ? [[item.path, item.signedUrl]] : [],
    ),
  );
  return new Map(
    withPicture.flatMap((row) => {
      const url = urlByPath.get(row.path);
      return url ? [[row.id, url] as [string, string]] : [];
    }),
  );
}

/**
 * Another player's public-within-the-app identity. RLS returns the profile
 * only to the player themselves or someone who shares a group with them, so
 * null means "not found" and "not yours" alike. Email is never selected.
 */
export const getPlayer = cache(
  async (playerId: string): Promise<PlayerProfile | null> => {
    await requireUser(`/players/${playerId}`);
    if (!asUuid(playerId)) return null;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, created_at, hometown, bio, avatar_path")
      .eq("id", playerId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.display_name,
      memberSince: data.created_at,
      hometown: data.hometown,
      bio: data.bio,
      avatarUrl: await signAvatar(data.avatar_path),
    };
  },
);
