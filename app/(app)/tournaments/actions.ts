"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/src/lib/auth/dal";
import { userFacingMessage } from "@/src/lib/errors";
import { asUuid, field, success, type ActionState } from "@/src/lib/forms";
import { echoValues, readSubmission } from "@/src/lib/matches/submission";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type DbError = { message: string; code?: string; details?: string | null };

function refresh(tournamentId: string) {
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentId}`, "layout");
  revalidatePath("/dashboard");
}

/** Runs one tournament function and reports the result for a dialog. */
async function call(
  formData: FormData,
  run: (
    supabase: Supabase,
    tournamentId: string,
  ) => PromiseLike<{ error: DbError | null }>,
  notice?: string,
): Promise<ActionState> {
  await requireUser();
  const tournamentId = asUuid(field(formData, "tournamentId"));
  if (!tournamentId) return { error: "That tournament could not be found." };

  const supabase = await createSupabaseServerClient();
  const { error } = await run(supabase, tournamentId);
  if (error) return { error: userFacingMessage(error) };

  refresh(tournamentId);
  return success(notice);
}

export async function createTournament(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser("/tournaments/new");
  const values = Object.fromEntries(
    ["groupId", "name", "cap", "seeding", "roundDays"].map((name) => [
      name,
      field(formData, name),
    ]),
  );
  const groupId = asUuid(values.groupId);
  if (!groupId)
    return { error: "Choose the group this tournament is for.", values };
  if (!values.name) return { error: "Give the tournament a name.", values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_tournament", {
    target_group: groupId,
    tournament_name: values.name,
    cap: Number(values.cap),
    seeding_method: values.seeding || "rating",
    days_per_round: Number(values.roundDays) || 7,
  });
  if (error) return { error: userFacingMessage(error), values };

  revalidatePath("/tournaments");
  redirect(`/tournaments/${data}?created=1`);
}

export async function registerForTournament(
  _previous: ActionState,
  formData: FormData,
) {
  return call(
    formData,
    (supabase, id) => supabase.rpc("register_for_tournament", { target: id }),
    "You are in. The draw is made when the organizer closes registration.",
  );
}

export async function unregisterFromTournament(
  _previous: ActionState,
  formData: FormData,
) {
  return call(formData, (supabase, id) =>
    supabase.rpc("unregister_from_tournament", { target: id }),
  );
}

export async function startTournament(
  _previous: ActionState,
  formData: FormData,
) {
  return call(formData, (supabase, id) =>
    supabase.rpc("start_tournament", { target: id }),
  );
}

export async function withdrawFromTournament(
  _previous: ActionState,
  formData: FormData,
) {
  const player = asUuid(field(formData, "userId"));
  return call(formData, (supabase, id) =>
    supabase.rpc("withdraw_from_tournament", { target: id, player }),
  );
}

export async function decideTie(_previous: ActionState, formData: FormData) {
  const tieId = asUuid(field(formData, "tieId"));
  const winner = field(formData, "winner");
  if (!tieId) return { error: "That tie could not be found." };
  if (!winner)
    return { error: "Choose who gets the walkover, or that neither played." };
  return call(formData, (supabase) =>
    supabase.rpc("decide_tie_by_organizer", {
      target_tie: tieId,
      // "none" puts both players out.
      winner: winner === "none" ? (null as unknown as string) : winner,
    }),
  );
}

export async function cancelTournament(
  _previous: ActionState,
  formData: FormData,
) {
  const reason = field(formData, "reason");
  if (!reason) return { error: "Give a reason for cancelling." };
  return call(formData, (supabase, id) =>
    supabase.rpc("cancel_tournament", { target: id, reason }),
  );
}

/** Submits a tie's result: an ordinary match the opponent then confirms. */
export async function submitTournamentMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const tieId = asUuid(field(formData, "tieId"));
  const opponent = asUuid(field(formData, "opponent"));
  if (!tieId || !opponent) return { error: "That tie could not be found." };

  const submission = readSubmission(formData, user.id, opponent);
  if (!submission.ok)
    return { error: submission.error, values: echoValues(formData) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_tournament_match", {
    target_tie: tieId,
    ...submission.value,
  });
  if (error)
    return { error: userFacingMessage(error), values: echoValues(formData) };

  revalidatePath("/tournaments", "layout");
  revalidatePath("/matches");
  revalidatePath("/dashboard");
  redirect(`/matches/${data.id}?submitted=1`);
}
