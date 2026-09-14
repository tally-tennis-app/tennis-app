"use client";
import { useActionState, useState } from "react";
import { saveMatch } from "@/app/matches/actions";
import type { MatchFormState } from "@/app/matches/form-state";
import type { MatchDetail } from "@/src/lib/matches/queries";
import { localDateInputValue } from "@/src/lib/matches/input";
const initial: MatchFormState = {};
const inputClass =
  "min-h-11 w-full rounded border border-[var(--line)] bg-white px-3 py-2";
export function MatchForm({
  groupId,
  viewerId,
  players,
  match,
}: {
  groupId: string;
  viewerId: string;
  players: { userId: string; displayName: string }[];
  match?: MatchDetail;
}) {
  const [state, action, pending] = useActionState(saveMatch, initial);
  const [outcome, setOutcome] = useState(match?.outcome ?? "completed");
  const [opponent, setOpponent] = useState(
    match?.player_b ?? players.find((p) => p.userId !== viewerId)?.userId ?? "",
  );
  const a = match?.player_a ?? viewerId,
    b = opponent;
  const today = localDateInputValue();
  const name = (id: string) =>
    players.find((p) => p.userId === id)?.displayName ?? "Player";
  const choices = players.filter((p) => p.userId === a || p.userId === b);
  return (
    <form
      onReset={(event) => event.preventDefault()}
      action={action}
      className="grid max-w-2xl gap-5"
    >
      <input type="hidden" name="groupId" value={groupId} />
      {match && <input type="hidden" name="matchId" value={match.id} />}
      {state.error && <p role="alert">{state.error}</p>}
      <label>
        Opponent
        <select
          className={inputClass}
          name="opponent"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          required
          disabled={Boolean(match)}
        >
          {players
            .filter((p) => p.userId !== a)
            .map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.displayName}
              </option>
            ))}
        </select>
      </label>
      {match && <input type="hidden" name="opponent" value={opponent} />}
      <label>
        Date played
        <input
          className={inputClass}
          type="date"
          name="playedOn"
          required
          max={today}
          defaultValue={match?.played_on ?? today}
        />
      </label>
      <label>
        Outcome
        <select
          className={inputClass}
          name="outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option value="completed">Completed</option>
          <option value="retired">Retired</option>
          <option value="walkover">Walkover</option>
        </select>
      </label>
      <label>
        Winner
        <select
          className={inputClass}
          name="winner"
          defaultValue={match?.winner ?? a}
          required
        >
          {choices.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.displayName}
            </option>
          ))}
        </select>
      </label>
      {outcome === "retired" && (
        <label>
          Player who retired
          <select
            className={inputClass}
            name="retiredBy"
            defaultValue={match?.retired_by ?? b}
            required
          >
            {choices.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      )}
      {outcome !== "walkover" ? (
        <>
          <p>
            Best of three sets: 6–0 through 6–4, 7–5, or 7–6. Leave unused sets
            blank. A retirement may end in an unfinished set.
          </p>
          {[1, 2, 3].map((n) => {
            const set = match?.match_sets.find((s) => s.set_number === n);
            return (
              <fieldset
                className="grid grid-cols-2 gap-3 rounded border border-[var(--line)] p-4"
                key={n}
              >
                <legend>Set {n}</legend>
                <label>
                  {name(a)} games
                  <input
                    aria-label={`Set ${n} ${name(a)} games`}
                    className={inputClass}
                    name={`gamesA${n}`}
                    type="number"
                    min="0"
                    max="7"
                    defaultValue={set?.games_a}
                  />
                </label>
                <label>
                  {name(b)} games
                  <input
                    aria-label={`Set ${n} ${name(b)} games`}
                    className={inputClass}
                    name={`gamesB${n}`}
                    type="number"
                    min="0"
                    max="7"
                    defaultValue={set?.games_b}
                  />
                </label>
                <label>
                  {name(a)} tiebreak points (optional)
                  <input
                    aria-label={`Set ${n} ${name(a)} tiebreak points`}
                    className={inputClass}
                    name={`tiebreakA${n}`}
                    type="number"
                    min="0"
                    defaultValue={set?.tiebreak_a ?? undefined}
                  />
                </label>
                <label>
                  {name(b)} tiebreak points (optional)
                  <input
                    aria-label={`Set ${n} ${name(b)} tiebreak points`}
                    className={inputClass}
                    name={`tiebreakB${n}`}
                    type="number"
                    min="0"
                    defaultValue={set?.tiebreak_b ?? undefined}
                  />
                </label>
                {outcome === "retired" && (
                  <label>
                    Set {n} status
                    <select
                      className={inputClass}
                      name={`complete${n}`}
                      defaultValue={set ? String(set.complete) : "false"}
                    >
                      <option value="true">Finished</option>
                      <option value="false">In progress</option>
                    </select>
                  </label>
                )}
              </fieldset>
            );
          })}
        </>
      ) : (
        <p>A walkover has no score and does not change ratings.</p>
      )}
      <p>
        Your opponent must confirm before this result counts. Confirmed scores
        cannot be edited.
      </p>
      <button
        className="min-h-12 rounded bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : match ? "Save changes" : "Submit match"}
      </button>
    </form>
  );
}
