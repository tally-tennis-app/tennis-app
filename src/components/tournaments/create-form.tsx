"use client";

import { useActionState, useState } from "react";

import { createTournament } from "@/app/(app)/tournaments/actions";
import { Alert, FormMessage } from "@/src/components/ui/feedback";
import { Field, inputClass } from "@/src/components/ui/field";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState } from "@/src/lib/forms";

const caps = [4, 8, 16, 32];

function Choice({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={`bg-surface flex min-h-14 cursor-pointer items-center gap-3 border px-4 py-3 ${
        checked ? "border-accent ring-accent ring-1" : "border-line-strong"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="size-5 shrink-0 accent-(--accent)"
      />
      <span className="flex flex-col">
        <span className="text-ink-strong font-semibold">{label}</span>
        {hint ? <span className="text-muted text-sm">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * One page, in the order an organizer decides: where, what, how big, how
 * seeded, how fast. The summary restates the rules the database will enforce.
 */
export function CreateTournamentForm({
  groups,
  preselect,
}: {
  groups: { id: string; name: string }[];
  preselect?: string;
}) {
  const [state, formAction] = useActionState(
    createTournament,
    emptyActionState,
  );
  const v = state.values;
  const [groupId, setGroupId] = useState(
    v?.groupId ?? preselect ?? (groups.length === 1 ? groups[0].id : ""),
  );
  const [cap, setCap] = useState(v?.cap ?? "8");
  const [seeding, setSeeding] = useState(v?.seeding ?? "rating");
  const [roundDays, setRoundDays] = useState(v?.roundDays ?? "7");

  return (
    <form action={formAction} className="flex max-w-prose flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="type-section mb-3">Group</legend>
        <p className="text-muted -mt-2 text-sm">Only its members can enter.</p>
        {groups.map((g) => (
          <Choice
            key={g.id}
            name="groupId"
            value={g.id}
            checked={groupId === g.id}
            onChange={setGroupId}
            label={g.name}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-section mb-3">Details</legend>
        <Field
          label="Name"
          name="name"
          maxLength={80}
          required
          defaultValue={v?.name}
          hint="For example, Autumn Knockout."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-section mb-3">Entry limit</legend>
        <p className="text-muted -mt-2 text-sm">
          The draw fits the players who actually enter, and the top seeds get
          any byes.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {caps.map((c) => (
            <Choice
              key={c}
              name="cap"
              value={String(c)}
              checked={cap === String(c)}
              onChange={setCap}
              label={`${c} players`}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-section mb-3">Seeding</legend>
        <Choice
          name="seeding"
          value="rating"
          checked={seeding === "rating"}
          onChange={setSeeding}
          label="By group rating"
          hint="The strongest players are kept apart until the late rounds."
        />
        <Choice
          name="seeding"
          value="random"
          checked={seeding === "random"}
          onChange={setSeeding}
          label="Random draw"
          hint="Anyone can meet anyone in the first round."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-section mb-3">Schedule</legend>
        <label
          htmlFor="roundDays"
          className="text-ink-strong text-sm font-semibold"
        >
          Days to play each round
        </label>
        <p id="roundDays-hint" className="text-muted -mt-1 text-sm">
          Deadlines are guidance. You decide what happens to a tie nobody
          played.
        </p>
        <input
          id="roundDays"
          name="roundDays"
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          required
          value={roundDays}
          onChange={(event) => setRoundDays(event.target.value)}
          aria-describedby="roundDays-hint"
          className={`${inputClass} max-w-32`}
        />
      </fieldset>

      <Alert tone="info" title="How it runs">
        Members enter until you make the draw. Each tie is an ordinary match:
        one player submits the score and the other confirms it, and the winner
        moves on. Results count toward ratings like any other match.
      </Alert>

      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Creating…" className="self-start">
        Open for entries
      </SubmitButton>
    </form>
  );
}
