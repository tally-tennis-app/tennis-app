"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { GroupFormState } from "@/app/groups/form-state";
import { requireUser } from "@/src/lib/auth/dal";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The database raises for every authorization failure, so the message it
 * returns is the one written in the migration and is safe to show. Anything
 * unexpected is reported generically rather than leaking a Postgres detail.
 */
function messageFor(error: { message: string; code?: string }): string {
  return error.code === "P0001" || error.message
    ? error.message
    : "Something went wrong. Try again.";
}

export async function createGroup(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  await requireUser("/groups");
  const name = field(formData, "name");

  if (!name) {
    return { error: "Give the group a name." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_group", {
    group_name: name,
  });

  if (error) {
    return { error: messageFor(error) };
  }

  redirect(`/groups/${data}`);
}

export async function joinGroup(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  await requireUser("/groups");
  const code = field(formData, "code");

  if (!code) {
    return { error: "Enter the invite code you were given." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_group_by_code", { code });

  if (error) {
    return { error: messageFor(error) };
  }

  redirect(`/groups/${data}`);
}

/**
 * The mutations below take the group and member from the form rather than a
 * closure. Every one of them is authorized again inside its database function,
 * so a forged form value fails there rather than here.
 */
export async function leaveGroup(formData: FormData): Promise<void> {
  await requireUser();
  const groupId = field(formData, "groupId");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("leave_group", {
    target_group: groupId,
  });

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/groups");
}

export async function removeMember(formData: FormData): Promise<void> {
  await requireUser();
  const groupId = field(formData, "groupId");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("remove_group_member", {
    target_group: groupId,
    target_user: field(formData, "userId"),
  });

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/groups/${groupId}`);
}

export async function restoreMember(formData: FormData): Promise<void> {
  await requireUser();
  const groupId = field(formData, "groupId");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("restore_group_member", {
    target_group: groupId,
    target_user: field(formData, "userId"),
  });

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/groups/${groupId}`);
}

export async function setMemberRole(formData: FormData): Promise<void> {
  await requireUser();
  const groupId = field(formData, "groupId");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("set_group_member_role", {
    target_group: groupId,
    target_user: field(formData, "userId"),
    new_role: field(formData, "role"),
  });

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/groups/${groupId}`);
}

export async function rotateInvite(formData: FormData): Promise<void> {
  await requireUser();
  const groupId = field(formData, "groupId");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("rotate_group_invite", {
    target_group: groupId,
  });

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/groups/${groupId}`);
}
