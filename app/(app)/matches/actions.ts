"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/src/lib/auth/dal";
import { userFacingMessage } from "@/src/lib/errors";
import { asUuid, field, success, type ActionState } from "@/src/lib/forms";
import type { SetScore } from "@/src/lib/matches/score";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function refresh(matchId?: string) {
  for (const path of ["/matches", "/dashboard", "/standings", "/profile"]) {
    revalidatePath(path);
  }
  if (matchId) revalidatePath(`/matches/${matchId}`);
}

/** The score form posts its sets as JSON; anything malformed becomes []. */
function parseSets(raw: string): SetScore[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.map((set) => ({
      a: Number(set?.a),
      b: Number(set?.b),
      tiebreak:
        set?.tiebreak === null ||
        set?.tiebreak === undefined ||
        set?.tiebreak === ""
          ? null
          : Number(set.tiebreak),
    }));
  } catch {
    return [];
  }
}

function scoreFields(formData: FormData) {
  return {
    played: field(formData, "playedOn"),
    match_outcome: field(formData, "outcome"),
    sets: parseSets(field(formData, "sets")),
    winner: asUuid(field(formData, "winner")),
  };
}

/** Everything the form sent, echoed back so a failure keeps the input. */
function values(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(
        ([name, value]) => !name.startsWith("$") && typeof value === "string",
      )
      .map(([name, value]) => [name, value as string]),
  );
}

export async function submitMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser("/matches/new");
  const groupId = asUuid(field(formData, "groupId"));
  const opponent = asUuid(field(formData, "opponent"));

  if (!groupId || !opponent) {
    return {
      error: "Choose a group and an opponent.",
      values: values(formData),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_match", {
    target_group: groupId,
    opponent,
    request: asUuid(field(formData, "requestId")),
    ...scoreFields(formData),
  });

  if (error) {
    return { error: userFacingMessage(error), values: values(formData) };
  }

  refresh();
  redirect(`/matches/${data}?submitted=1`);
}

export async function updateMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchId = asUuid(field(formData, "matchId"));
  await requireUser(`/matches/${matchId ?? ""}`);
  if (!matchId) return { error: "That match could not be found." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_match", {
    target_match: matchId,
    ...scoreFields(formData),
  });

  if (error) {
    return { error: userFacingMessage(error), values: values(formData) };
  }

  refresh(matchId);
  redirect(`/matches/${matchId}?updated=1`);
}

type MatchCall =
  | { fn: "confirm_match"; args: { target_match: string } }
  | { fn: "reject_match"; args: { target_match: string; reason?: string } }
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

export async function confirmMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchId = asUuid(field(formData, "matchId"));
  if (!matchId) return { error: "That match could not be found." };
  return callMatch({ fn: "confirm_match", args: { target_match: matchId } });
}

export async function rejectMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchId = asUuid(field(formData, "matchId"));
  if (!matchId) return { error: "That match could not be found." };
  return callMatch({
    fn: "reject_match",
    args: {
      target_match: matchId,
      reason: field(formData, "reason") || undefined,
    },
  });
}

export async function withdrawMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchId = asUuid(field(formData, "matchId"));
  if (!matchId) return { error: "That match could not be found." };
  const result = await callMatch({
    fn: "withdraw_match",
    args: { target_match: matchId },
  });
  if (result.error) return result;
  // The match no longer exists, so its page would 404.
  redirect("/matches?withdrawn=1");
}

export async function voidMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchId = asUuid(field(formData, "matchId"));
  const reason = field(formData, "reason");
  if (!matchId) return { error: "That match could not be found." };
  if (!reason) return { error: "Give a reason for voiding the match." };
  return callMatch({
    fn: "void_match",
    args: { target_match: matchId, reason },
  });
}
