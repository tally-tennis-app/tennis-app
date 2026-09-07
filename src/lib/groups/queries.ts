import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type GroupSummary = {
  id: string;
  name: string;
  role: string;
};

export type GroupMember = {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
};

export type GroupDetail = {
  id: string;
  name: string;
  inviteCode: string;
  inviteExpiresAt: string;
  members: GroupMember[];
  viewerId: string;
  viewerIsOrganizer: boolean;
};

/**
 * Groups the signed-in user is an active member of.
 *
 * No group filter is needed: the select policy on group_members already limits
 * rows to groups the caller belongs to. The user_id filter is about "mine"
 * rather than "permitted".
 */
export const listMyGroups = cache(async (): Promise<GroupSummary[]> => {
  const user = await requireUser("/groups");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("group_members")
    .select("role, groups(id, name)")
    .eq("user_id", user.id)
    .is("left_at", null);

  if (error) throw error;

  return (data ?? [])
    .flatMap((row) =>
      row.groups ? [{ group: row.groups, role: row.role }] : [],
    )
    .map(({ group, role }) => ({ id: group.id, name: group.name, role }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

/**
 * A single group with its full roster, or null when the caller cannot see it.
 *
 * A non-member gets null rather than an error: RLS filters the row out, so
 * "does not exist" and "not yours" are indistinguishable from here. That is the
 * intended behaviour -- it stops a stranger probing which group ids are real.
 */
export const getGroup = cache(
  async (groupId: string): Promise<GroupDetail | null> => {
    const user = await requireUser(`/groups/${groupId}`);
    const supabase = await createSupabaseServerClient();

    const { data: group, error: groupError } = await supabase
      .from("groups")
      // Any member can read invite_code: the policy is row-level, not
      // column-level. Members share the code; organizers rotate it to revoke.
      .select("id, name, invite_code, invite_expires_at")
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!group) return null;

    const { data: memberRows, error: memberError } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at, left_at, profiles(display_name)")
      .eq("group_id", groupId);

    if (memberError) throw memberError;

    const members: GroupMember[] = (memberRows ?? [])
      .map((row) => ({
        userId: row.user_id,
        displayName: row.profiles?.display_name ?? "Unknown player",
        role: row.role,
        joinedAt: row.joined_at,
        leftAt: row.left_at,
      }))
      // Active first, then organizers, then by name.
      .sort(
        (a, b) =>
          Number(Boolean(a.leftAt)) - Number(Boolean(b.leftAt)) ||
          a.role.localeCompare(b.role) ||
          a.displayName.localeCompare(b.displayName),
      );

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.invite_code,
      inviteExpiresAt: group.invite_expires_at,
      members,
      viewerId: user.id,
      viewerIsOrganizer: members.some(
        (member) =>
          member.userId === user.id &&
          member.role === "organizer" &&
          !member.leftAt,
      ),
    };
  },
);
