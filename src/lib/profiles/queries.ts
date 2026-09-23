import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { signAvatar } from "@/src/lib/profiles/players";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string;
  displayName: string;
  hometown: string | null;
  bio: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
};

/** The signed-in player, for the shell and anything personal on a page. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, hometown, bio, avatar_path")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: data.display_name,
    hometown: data.hometown,
    bio: data.bio,
    avatarPath: data.avatar_path,
    avatarUrl: await signAvatar(data.avatar_path),
  };
});
