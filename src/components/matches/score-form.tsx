"use client";

import { MinusIcon, PlusIcon } from "@phosphor-icons/react/ssr";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { submitMatch, updateMatch } from "@/app/(app)/matches/actions";
import { submitTournamentMatch } from "@/app/(app)/tournaments/actions";
import { MatchCard } from "@/src/components/matches/match-card";
import { Button } from "@/src/components/ui/button";
import { Alert, FormMessage } from "@/src/components/ui/feedback";
import { inputClass } from "@/src/components/ui/field";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { formatPlayedOn } from "@/src/lib/format";
import { emptyActionState } from "@/src/lib/forms";
import type { GroupWithRoster } from "@/src/lib/groups/queries";
import {
  isCompleteSet,
  isTiebreakSet,
  setWinner,
  validateScore,
  type Outcome,
  type SetScore,
} from "@/src/lib/matches/score";

type Person = { id: string; name: string };
type SetDraft = { a: string; b: string; tiebreak: string };
type Step = "group" | "opponent" | "details" | "score" | "winner" | "review";

const stepLabels: Record<Step, string> = {
  group: "Group",
  opponent: "Opponent",
  details: "Match",
  score: "Score",
  winner: "Result",
  review: "Review",
};

const outcomes: { value: Outcome; label: string; hint: string }[] = [
  { value: "completed", label: "Completed", hint: "Played to the end." },
  {
    value: "retired",
    label: "Retired",
    hint: "Someone stopped part way through.",
  },
  { value: "walkover", label: "Walkover", hint: "No play. Not rated." },
];

const emptySet = (): SetDraft => ({ a: "", b: "", tiebreak: "" });

function toDraft(sets: SetScore[]): SetDraft[] {
  return sets.map((set) => ({
    a: String(set.a),
    b: String(set.b),
    tiebreak: set.tiebreak == null ? "" : String(set.tiebreak),
  }));
}

function toScores(drafts: SetDraft[]): SetScore[] | null {
  if (drafts.some((set) => set.a === "" || set.b === "")) return null;
  return drafts.map((set) => ({
    a: Number(set.a),
    b: Number(set.b),
    tiebreak:
      set.tiebreak !== "" &&
      isTiebreakSet({ a: Number(set.a), b: Number(set.b) })
        ? Number(set.tiebreak)
        : null,
  }));
}

/** A completed match shows set 3 only when sets 1 and 2 were split. */
function withDecider(drafts: SetDraft[]): SetDraft[] {
  const [first, second] = toScores(drafts.slice(0, 2)) ?? [];
  const split =
    first &&
    second &&
    isCompleteSet(first) &&
    isCompleteSet(second) &&
    setWinner(first) !== setWinner(second);
  if (split && drafts.length === 2) return [...drafts, emptySet()];
  if (!split && drafts.length === 3) return drafts.slice(0, 2);
  return drafts;
}

export type ScoreFormInitial = {
  matchId: string;
  group: Person;
  opponent: Person;
  playedOn: string;
  outcome: Outcome;
  sets: SetScore[];
  winnerId: string;
};

export function ScoreForm({
  viewer,
  groups = [],
  initial,
  requestId,
  today,
  preselectGroup,
  tie,
}: {
  viewer: Person;
  groups?: GroupWithRoster[];
  /** Present when editing a pending or rejected submission. */
  initial?: ScoreFormInitial;
  /** Present when submitting a tournament tie: the draw fixes the players. */
  tie?: { id: string; group: Person; opponent: Person };
  requestId?: string;
  today: string;
  preselectGroup?: string;
}) {
  const editing = Boolean(initial);
  const fixed = initial ?? tie;
  const [state, formAction] = useActionState(
    editing ? updateMatch : tie ? submitTournamentMatch : submitMatch,
    emptyActionState,
  );

  const firstGroup =
    groups.find((group) => group.id === preselectGroup) ??
    (groups.length === 1 ? groups[0] : undefined);
  const [groupId, setGroupId] = useState(
    fixed?.group.id ?? firstGroup?.id ?? "",
  );
  const [opponentId, setOpponentId] = useState(fixed?.opponent.id ?? "");
  const [playedOn, setPlayedOn] = useState(initial?.playedOn ?? today);
  const [outcome, setOutcome] = useState<Outcome>(
    initial?.outcome ?? "completed",
  );
  const [sets, setSets] = useState<SetDraft[]>(
    initial ? toDraft(initial.sets) : [emptySet(), emptySet()],
  );
  const [winner, setWinner_] = useState(initial?.winnerId ?? "");
  const [stepError, setStepError] = useState<string | null>(null);

  const group = groups.find((g) => g.id === groupId) ?? fixed?.group;
  const opponents =
    groups
      .find((g) => g.id === groupId)
      ?.members.filter((m) => m.id !== viewer.id) ?? [];
  const opponent =
    opponents.find((person) => person.id === opponentId) ?? fixed?.opponent;

  const steps: Step[] = [
    ...(fixed ? [] : (["group", "opponent"] as Step[])),
    "details",
    ...(outcome === "walkover" ? [] : (["score"] as Step[])),
    ...(outcome === "completed" ? [] : (["winner"] as Step[])),
    "review",
  ];
  const [step, setStep] = useState<Step>(
    fixed ? "details" : firstGroup ? "opponent" : "group",
  );
  const index = Math.max(steps.indexOf(step), 0);

  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    // Move focus to each new step's heading so a screen reader announces it,
    // but not on first load, which would steal focus from the page.
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  const scores = outcome === "walkover" ? [] : toScores(sets);
  const validation = scores ? validateScore(outcome, scores) : null;
  const winnerId =
    validation?.error === null && validation.winner
      ? validation.winner === "a"
        ? viewer.id
        : opponent?.id
      : winner;

  function check(current: Step): string | null {
    switch (current) {
      case "group":
        return groupId ? null : "Choose the group this match belongs to.";
      case "opponent":
        return opponentId ? null : "Choose who you played.";
      case "details":
        if (!playedOn) return "Enter the date you played.";
        if (playedOn > today) return "The date played cannot be in the future.";
        return null;
      case "score":
        if (!scores) return "Enter both scores for every set.";
        return validation?.error ?? null;
      case "winner":
        return winner
          ? null
          : outcome === "retired"
            ? "Choose who retired."
            : "Choose who won.";
      default:
        return null;
    }
  }

  function go(to: number) {
    if (to > index) {
      const problem = check(step);
      setStepError(problem);
      if (problem) return;
    } else {
      setStepError(null);
    }
    setStep(steps[Math.min(Math.max(to, 0), steps.length - 1)]);
  }

  // Enter in a field advances instead of submitting from an early step.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (step !== "review") {
      event.preventDefault();
      go(index + 1);
    }
  }

  function chooseOutcome(next: Outcome) {
    setOutcome(next);
    setWinner_("");
    setSets(
      next === "walkover"
        ? []
        : next === "completed"
          ? withDecider(
              sets.length >= 2 ? sets.slice(0, 3) : [emptySet(), emptySet()],
            )
          : sets.length
            ? sets
            : [emptySet()],
    );
  }

  function updateSet(position: number, patch: Partial<SetDraft>) {
    const next = sets.map((set, i) =>
      i === position ? { ...set, ...patch } : set,
    );
    setSets(outcome === "completed" ? withDecider(next) : next);
  }

  const preview = {
    id: "preview",
    group: { id: groupId, name: group?.name ?? "" },
    playedOn,
    outcome,
    status: "pending" as const,
    submitter: viewer,
    opponent: opponent ?? { id: "opponent", name: "Opponent" },
    winnerId: winnerId || viewer.id,
    sets: scores ?? [],
    submittedAt: new Date().toISOString(),
    confirmedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    voidedAt: null,
    voidReason: null,
    ratingDeltas: {},
  };

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="opponent" value={opponentId} />
      <input type="hidden" name="playedOn" value={playedOn} />
      <input type="hidden" name="outcome" value={outcome} />
      <input type="hidden" name="sets" value={JSON.stringify(scores ?? [])} />
      <input type="hidden" name="winner" value={winnerId ?? ""} />
      {requestId ? (
        <input type="hidden" name="requestId" value={requestId} />
      ) : null}
      {initial ? (
        <input type="hidden" name="matchId" value={initial.matchId} />
      ) : null}
      {tie ? <input type="hidden" name="tieId" value={tie.id} /> : null}

      <ol
        aria-label="Progress"
        className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
      >
        {steps.map((name, i) => (
          <li
            key={name}
            aria-current={name === step ? "step" : undefined}
            className={
              name === step
                ? "text-ink-strong border-accent border-b-2 font-bold"
                : i < index
                  ? "text-ink"
                  : "text-muted"
            }
          >
            {stepLabels[name]}
          </li>
        ))}
      </ol>

      <fieldset className="flex min-w-0 flex-col gap-5">
        <legend className="contents">
          <h2 ref={heading} tabIndex={-1} className="type-section outline-none">
            {
              {
                group: "Which group was this match in?",
                opponent: "Who did you play?",
                details: "When did you play, and how did it end?",
                score: "What was the score?",
                winner:
                  outcome === "retired"
                    ? "Who retired?"
                    : "Who won by walkover?",
                review: "Check the result before you send it",
              }[step]
            }
          </h2>
        </legend>

        {step === "group" ? (
          <ChoiceList
            name="group-choice"
            value={groupId}
            onChange={(id) => {
              setGroupId(id);
              setOpponentId("");
            }}
            options={groups.map((g) => ({
              value: g.id,
              label: g.name,
              hint: `${g.members.length} ${g.members.length === 1 ? "member" : "members"}`,
            }))}
          />
        ) : null}

        {step === "opponent" ? (
          opponents.length === 0 ? (
            <Alert tone="info" title="No one else is in this group yet">
              Share the group&apos;s invite code, then log your match once your
              opponent has joined.
            </Alert>
          ) : (
            <ChoiceList
              name="opponent-choice"
              value={opponentId}
              onChange={setOpponentId}
              options={opponents.map((p) => ({ value: p.id, label: p.name }))}
            />
          )
        ) : null}

        {step === "details" ? (
          <>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="played-on"
                className="text-ink-strong text-sm font-semibold"
              >
                Date played
              </label>
              <input
                id="played-on"
                type="date"
                value={playedOn}
                max={today}
                onChange={(event) => setPlayedOn(event.target.value)}
                className={`${inputClass} max-w-56`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p
                id="outcome-label"
                className="text-ink-strong text-sm font-semibold"
              >
                How it ended
              </p>
              <ChoiceList
                name="outcome-choice"
                labelledBy="outcome-label"
                value={outcome}
                onChange={(value) => chooseOutcome(value as Outcome)}
                options={outcomes}
                columns
              />
            </div>
          </>
        ) : null}

        {step === "score" ? (
          <ScoreGrid
            sets={sets}
            names={[viewer.name, opponent?.name ?? "Opponent"]}
            onChange={updateSet}
            retired={outcome === "retired"}
            onAdd={() => setSets([...sets, emptySet()])}
            onRemove={() => setSets(sets.slice(0, -1))}
          />
        ) : null}

        {step === "winner" && opponent ? (
          <ChoiceList
            name="winner-choice"
            value={
              outcome === "retired"
                ? winner === viewer.id
                  ? opponent.id
                  : winner === opponent.id
                    ? viewer.id
                    : ""
                : winner
            }
            // For a retirement the player names who stopped; the winner is
            // the other player.
            onChange={(id) =>
              setWinner_(
                outcome === "retired"
                  ? id === viewer.id
                    ? opponent.id
                    : viewer.id
                  : id,
              )
            }
            options={[
              { value: viewer.id, label: `${viewer.name} (you)` },
              { value: opponent.id, label: opponent.name },
            ]}
          />
        ) : null}

        {step === "review" ? (
          <>
            <MatchCard match={preview} href={null} />
            <Alert
              tone="info"
              title={`${opponent?.name ?? "Your opponent"} confirms next`}
            >
              They have 14 days to confirm or reject it. Once confirmed it
              counts toward ratings and cannot be edited. Played{" "}
              {formatPlayedOn(playedOn)} in {group?.name}.
            </Alert>
          </>
        ) : null}

        <div aria-live="polite" className="empty:hidden">
          {stepError ? <Alert tone="critical">{stepError}</Alert> : null}
        </div>
        {step === "review" ? <FormMessage error={state.error} /> : null}
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {index > 0 ? (
          <Button variant="secondary" onClick={() => go(index - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step === "review" ? (
          <SubmitButton pendingLabel="Sending…">
            {editing ? "Save changes" : "Send for confirmation"}
          </SubmitButton>
        ) : (
          <Button onClick={() => go(index + 1)}>Continue</Button>
        )}
      </div>
    </form>
  );
}

function ChoiceList({
  name,
  value,
  onChange,
  options,
  columns = false,
  labelledBy,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
  columns?: boolean;
  labelledBy?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={`grid gap-2 ${columns ? "sm:grid-cols-3" : ""}`}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={`bg-surface flex min-h-14 cursor-pointer items-center gap-3 border px-4 py-3 ${
              checked
                ? "border-accent ring-accent ring-1"
                : "border-line-strong"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="size-5 shrink-0 accent-(--accent)"
            />
            <span className="flex flex-col">
              <span className="text-ink-strong font-semibold">
                {option.label}
              </span>
              {option.hint ? (
                <span className="text-muted text-sm">{option.hint}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function GamesInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      maxLength={1}
      pattern="[0-7]"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/[^0-7]/g, ""))}
      className="border-line-strong bg-surface type-score focus-visible:ring-focus size-14 border text-center text-2xl outline-none focus-visible:ring-2"
    />
  );
}

function ScoreGrid({
  sets,
  names,
  onChange,
  retired,
  onAdd,
  onRemove,
}: {
  sets: SetDraft[];
  names: [string, string];
  onChange: (position: number, patch: Partial<SetDraft>) => void;
  retired: boolean;
  onAdd: () => void;
  onRemove: () => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-5">
      {retired ? (
        <p className="text-muted text-sm">
          Enter each set as it stood. The last set can be unfinished. Remove
          every set if no games were played.
        </p>
      ) : null}
      {sets.map((set, position) => {
        const a = Number(set.a);
        const b = Number(set.b);
        const tiebreak =
          set.a !== "" && set.b !== "" && isTiebreakSet({ a, b });
        const label = `Set ${position + 1}`;
        return (
          <fieldset key={position} className="flex flex-col gap-3">
            <legend className="text-ink-strong mb-2 font-semibold">
              {label}
            </legend>
            <div className="flex flex-wrap items-end gap-4">
              {[0, 1].map((side) => (
                <div key={side} className="flex flex-col gap-1">
                  <span
                    aria-hidden
                    className="text-muted max-w-32 truncate text-sm"
                  >
                    {names[side]}
                  </span>
                  <GamesInput
                    label={`${label}, ${names[side]} games`}
                    value={side === 0 ? set.a : set.b}
                    onChange={(value) =>
                      onChange(
                        position,
                        side === 0 ? { a: value } : { b: value },
                      )
                    }
                  />
                </div>
              ))}
              {tiebreak ? (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`tiebreak-${position}`}
                    className="text-muted text-sm"
                  >
                    Tiebreak loser&apos;s points (optional)
                  </label>
                  <input
                    id={`tiebreak-${position}`}
                    inputMode="numeric"
                    maxLength={2}
                    value={set.tiebreak}
                    onChange={(event) =>
                      onChange(position, {
                        tiebreak: event.target.value.replace(/\D/g, ""),
                      })
                    }
                    className={`${inputClass} w-24`}
                  />
                </div>
              ) : null}
            </div>
          </fieldset>
        );
      })}
      {retired ? (
        <div className="flex flex-wrap gap-3">
          {sets.length < 3 ? (
            <Button variant="secondary" size="sm" onClick={onAdd}>
              <PlusIcon aria-hidden weight="bold" className="size-4" />
              Add set
            </Button>
          ) : null}
          {sets.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={onRemove}>
              <MinusIcon aria-hidden weight="bold" className="size-4" />
              Remove last set
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
