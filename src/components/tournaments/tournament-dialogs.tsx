"use client";

import {
  cancelTournament,
  decideTie,
  startTournament,
  unregisterFromTournament,
  withdrawFromTournament,
} from "@/app/(app)/tournaments/actions";
import { ActionDialog } from "@/src/components/ui/dialog";
import { inputClass } from "@/src/components/ui/field";
import type { Person } from "@/src/lib/tournaments/types";

export function UnregisterDialog({ tournamentId }: { tournamentId: string }) {
  return (
    <ActionDialog
      trigger={{ label: "Leave the entry list", variant: "secondary" }}
      title="Take your name off the entry list?"
      description="You can enter again while registration is open."
      action={unregisterFromTournament}
      hidden={{ tournamentId }}
      submitLabel="Remove my entry"
      pendingLabel="Removing…"
    />
  );
}

export function WithdrawDialog({
  tournamentId,
  player,
  own,
}: {
  tournamentId: string;
  player?: Person;
  own: boolean;
}) {
  return (
    <ActionDialog
      trigger={{
        label: own ? "Withdraw" : `Withdraw ${player?.name}`,
        variant: "critical",
        size: own ? "md" : "sm",
      }}
      title={
        own ? "Withdraw from the tournament?" : `Withdraw ${player?.name}?`
      }
      description="Their current opponent advances. Any result waiting on this tie is removed. This cannot be undone."
      action={withdrawFromTournament}
      hidden={{
        tournamentId,
        ...(player && !own ? { userId: player.id } : {}),
      }}
      submitLabel="Withdraw"
      submitVariant="critical"
      pendingLabel="Withdrawing…"
    />
  );
}

export function StartDialog({
  tournamentId,
  entrantCount,
}: {
  tournamentId: string;
  entrantCount: number;
}) {
  let size = 2;
  while (size < entrantCount) size *= 2;
  const byes = size - entrantCount;

  return (
    <ActionDialog
      trigger={{ label: "Close entries and make the draw" }}
      title="Make the draw?"
      description={`Registration closes and ${entrantCount} players are placed in a draw of ${size}${
        byes
          ? `, with ${byes} ${byes === 1 ? "bye" : "byes"} for the top seeds`
          : ""
      }. The draw cannot be changed afterwards.`}
      action={startTournament}
      hidden={{ tournamentId }}
      submitLabel="Make the draw"
      pendingLabel="Drawing…"
    />
  );
}

export function DecideTieDialog({
  tournamentId,
  tieId,
  players,
  round,
}: {
  tournamentId: string;
  tieId: string;
  players: [Person, Person];
  round: string;
}) {
  return (
    <ActionDialog
      trigger={{
        label: "Decide without a match",
        variant: "secondary",
        size: "sm",
      }}
      title={`${round}: ${players[0].name} v ${players[1].name}`}
      description="For a tie that was not played. A walkover is not rated. Any result waiting on this tie is removed."
      action={decideTie}
      hidden={{ tournamentId, tieId }}
      submitLabel="Record decision"
      pendingLabel="Recording…"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-ink-strong mb-2 text-sm font-semibold">
          Outcome
        </legend>
        {[
          ...players.map((p) => ({
            value: p.id,
            label: `Walkover to ${p.name}`,
          })),
          { value: "none", label: "Neither played. Both are out." },
        ].map((option) => (
          <label
            key={option.value}
            className="border-line-strong bg-surface flex min-h-12 cursor-pointer items-center gap-3 border px-3"
          >
            <input
              type="radio"
              name="winner"
              value={option.value}
              required
              className="size-5 accent-(--accent)"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </ActionDialog>
  );
}

export function CancelTournamentDialog({
  tournamentId,
}: {
  tournamentId: string;
}) {
  return (
    <ActionDialog
      trigger={{ label: "Cancel tournament", variant: "critical" }}
      title="Cancel this tournament?"
      description="Confirmed matches keep counting toward ratings. Results still waiting become ordinary matches in the group. This cannot be undone."
      action={cancelTournament}
      hidden={{ tournamentId }}
      submitLabel="Cancel tournament"
      submitVariant="critical"
      pendingLabel="Cancelling…"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="cancel-reason"
          className="text-ink-strong text-sm font-semibold"
        >
          Reason
        </label>
        <p id="cancel-reason-hint" className="text-muted -mt-1 text-sm">
          Everyone in the tournament will see it.
        </p>
        <textarea
          id="cancel-reason"
          name="reason"
          required
          maxLength={200}
          rows={3}
          aria-describedby="cancel-reason-hint"
          className={`${inputClass} py-2`}
        />
      </div>
    </ActionDialog>
  );
}
