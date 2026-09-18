"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/src/lib/auth/dal";
import { userFacingMessage } from "@/src/lib/errors";
import { asUuid, field, success, type ActionState } from "@/src/lib/forms";
import { echoValues, readSubmission } from "@/src/lib/matches/submission";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function refresh(matchId?: string) {
  for (const path of ["/matches", "/dashboard", "/standings", "/profile"]) {
    revalidatePath(path);
  }
  revalidatePath("/tournaments", "layout");
  if (matchId) revalidatePath(`/matches/${matchId}`);
}

export async function submitMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/matches/new");
  const groupId = asUuid(field(formData, "groupId"));
  const opponent = asUuid(field(formData, "opponent"));
  if (!groupId || !opponent) {
    return {
      error: "Choose a group and an opponent.",
      values: echoValues(formData),
    };
  }

  const submission = readSubmission(formData, user.id, opponent);
  if (!submission.ok)
    return { error: submission.error, values: echoValues(formData) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_match", {
    target_group: groupId,
    opponent,
    ...submission.value,
  });
  if (error)
    return { error: userFacingMessage(error), values: echoValues(formData) };

  refresh();
  redirect(`/matches/${data.id}?submitted=1`);
}

export async function updateMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchId = asUuid(field(formData, "matchId"));
  const user = await requireUser(`/matches/${matchId ?? ""}`);
  const opponent = asUuid(field(formData, "opponent"));
  if (!matchId || !opponent) return { error: "That match could not be found." };

  // Only the submitter may edit, so the editor is side A.
  const submission = readSubmission(formData, user.id, opponent);
  if (!submission.ok)
    return { error: submission.error, values: echoValues(formData) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("edit_match", {
    target_match: matchId,
    ...submission.value,
  });
  if (error)
    return { error: userFacingMessage(error), values: echoValues(formData) };

  refresh(matchId);
  redirect(`/matches/${matchId}?updated=1`);
}

type MatchCall =
  | { fn: "confirm_match"; args: { target_match: string } }
  | { fn: "reject_match"; args: { target_match: string; reason: string } }
  | { fn: "withdraw_match"; args: { target_match: string } }
  | { fn: "void_match"; args: { target_match: string; reason: string } };

async function callMatch(call: MatchCall): Promise<ActionState> {
  await requireUser(`/matches/${call.args.target_match}`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(call.fn, call.args as never);
  if (error) return { error: userFacingMessage(error) };
  refresh(call.args.target_match);
  return success();
}

function matchIdFrom(formData: FormData) {
  return asUuid(field(formData, "matchId"));
}

export async function confirmMatch(_previous: ActionState, formData: FormData) {
  const matchId = matchIdFrom(formData);
  if (!matchId) return { error: "That match could not be found." };
  return callMatch({ fn: "confirm_match", args: { target_match: matchId } });
}

export async function rejectMatch(_previous: ActionState, formData: FormData) {
  const matchId = matchIdFrom(formData);
  if (!matchId) return { error: "That match could not be found." };
  return callMatch({
    fn: "reject_match",
    args: { target_match: matchId, reason: field(formData, "reason") },
  });
}

export async function withdrawMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchId = matchIdFrom(formData);
  if (!matchId) return { error: "That match could not be found." };
  const result = await callMatch({
    fn: "withdraw_match",
    args: { target_match: matchId },
  });
  if (result.error) return result;
  // The match no longer exists, so its page would 404.
  redirect("/matches?withdrawn=1");
}

export async function voidMatch(_previous: ActionState, formData: FormData) {
  const matchId = matchIdFrom(formData);
  const reason = field(formData, "reason");
  if (!matchId) return { error: "That match could not be found." };
  if (!reason) return { error: "Give a reason for voiding the match." };
  return callMatch({
    fn: "void_match",
    args: { target_match: matchId, reason },
  });
}
