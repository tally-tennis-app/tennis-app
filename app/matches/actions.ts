"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/src/lib/auth/dal";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { field, parseMatchInput, matchError } from "@/src/lib/matches/input";
import type { MatchFormState } from "./form-state";
function refresh(groupId: string, id?: string) {
  for (const path of [
    "/dashboard",
    "/matches",
    "/standings",
    "/profile",
    `/groups/${groupId}`,
    `/groups/${groupId}/matches`,
    `/groups/${groupId}/standings`,
    ...(id ? [`/matches/${id}`, `/matches/${id}/edit`] : []),
  ])
    revalidatePath(path);
}
export async function saveMatch(
  _previous: MatchFormState,
  form: FormData,
): Promise<MatchFormState> {
  await requireUser();
  const parsed = parseMatchInput(form);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value,
    db = await createSupabaseServerClient(),
    id = field(form, "matchId"),
    groupId = field(form, "groupId");
  const args = {
    match_outcome: v.outcome,
    match_winner: v.winner,
    sets: v.sets,
    match_played_on: v.playedOn,
    match_retired_by: v.retiredBy ?? undefined,
  };
  const { data, error } = id
    ? await db.rpc("edit_match", { ...args, target_match: id })
    : await db.rpc("submit_match", {
        ...args,
        target_group: groupId,
        opponent: v.opponent,
      });
  if (error) return { error: matchError(error) };
  if (!data) return { error: "The match could not be saved." };
  refresh(data.group_id, data.id);
  redirect(`/matches/${data.id}`);
}
export async function changeMatch(form: FormData): Promise<void> {
  await requireUser();
  const db = await createSupabaseServerClient(),
    id = field(form, "matchId"),
    action = field(form, "action");
  if (
    !["confirm_match", "reject_match", "withdraw_match", "void_match"].includes(
      action,
    )
  )
    return;
  const { data: match } = await db
    .from("matches")
    .select("group_id")
    .eq("id", id)
    .maybeSingle();
  if (!match) redirect("/matches");
  const { error } = await db.rpc(
    action as
      "confirm_match" | "reject_match" | "withdraw_match" | "void_match",
    { target_match: id },
  );
  if (error)
    redirect(`/matches/${id}?error=${encodeURIComponent(matchError(error))}`);
  refresh(match.group_id, id);
  redirect(action === "withdraw_match" ? "/matches" : `/matches/${id}`);
}
