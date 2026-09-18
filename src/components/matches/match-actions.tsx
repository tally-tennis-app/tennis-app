"use client";

import {
  confirmMatch,
  rejectMatch,
  voidMatch,
  withdrawMatch,
} from "@/app/(app)/matches/actions";
import { ActionDialog } from "@/src/components/ui/dialog";
import { inputClass } from "@/src/components/ui/field";

// Each consequential action asks first and closes only when the server
// accepts it, so the page never shows a result the database refused.

export function ConfirmMatchButton({
  matchId,
  score,
}: {
  matchId: string;
  score: string;
}) {
  return (
    <ActionDialog
      trigger={{ label: "Confirm score" }}
      title="Confirm this score?"
      description={`${score}. Once confirmed it counts toward ratings and can never be edited.`}
      action={confirmMatch}
      hidden={{ matchId }}
      submitLabel="Confirm score"
      pendingLabel="Confirming…"
    />
  );
}

export function RejectMatchButton({ matchId }: { matchId: string }) {
  return (
    <ActionDialog
      trigger={{ label: "Reject score", variant: "secondary" }}
      title="Reject this score?"
      description="Your opponent can correct it and send it again. Saying what was wrong helps them fix it."
      action={rejectMatch}
      hidden={{ matchId }}
      submitLabel="Reject score"
      submitVariant="critical"
      pendingLabel="Rejecting…"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="reject-reason"
          className="text-ink-strong text-sm font-semibold"
        >
          What was wrong? (optional)
        </label>
        <textarea
          id="reject-reason"
          name="reason"
          maxLength={200}
          rows={3}
          className={`${inputClass} py-2`}
        />
      </div>
    </ActionDialog>
  );
}

export function WithdrawMatchButton({ matchId }: { matchId: string }) {
  return (
    <ActionDialog
      trigger={{ label: "Withdraw", variant: "critical" }}
      title="Withdraw this match?"
      description="It will be deleted and your opponent will no longer be asked to confirm it."
      action={withdrawMatch}
      hidden={{ matchId }}
      submitLabel="Withdraw match"
      submitVariant="critical"
      pendingLabel="Withdrawing…"
    />
  );
}

export function VoidMatchButton({ matchId }: { matchId: string }) {
  return (
    <ActionDialog
      trigger={{ label: "Void match", variant: "critical" }}
      title="Void this match?"
      description="The score stays on record, marked void, and the match stops counting toward ratings. Every later rating recalculates. This cannot be undone."
      action={voidMatch}
      hidden={{ matchId }}
      submitLabel="Void match"
      submitVariant="critical"
      pendingLabel="Voiding…"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="void-reason"
          className="text-ink-strong text-sm font-semibold"
        >
          Reason
        </label>
        <p id="void-reason-hint" className="text-muted -mt-1 text-sm">
          Both players and the group will see it.
        </p>
        <textarea
          id="void-reason"
          name="reason"
          required
          maxLength={200}
          rows={3}
          aria-describedby="void-reason-hint"
          className={`${inputClass} py-2`}
        />
      </div>
    </ActionDialog>
  );
}
