"use client";

import {
  CopyIcon,
  PlusIcon,
  ShareNetworkIcon,
  SignInIcon,
} from "@phosphor-icons/react/ssr";
import { useState, useSyncExternalStore } from "react";

import {
  createGroup,
  joinGroup,
  leaveGroup,
  removeMember,
  restoreMember,
  rotateInvite,
  setMemberRole,
  transferOrganizer,
} from "@/app/(app)/groups/actions";
import { Button } from "@/src/components/ui/button";
import { ActionDialog } from "@/src/components/ui/dialog";
import { Field, inputClass } from "@/src/components/ui/field";

export function CreateGroupDialog({
  variant = "primary",
}: {
  variant?: "primary" | "secondary";
}) {
  return (
    <ActionDialog
      trigger={{
        label: (
          <>
            <PlusIcon aria-hidden weight="bold" className="size-5" />
            Create group
          </>
        ),
        variant,
      }}
      title="Create a group"
      description="You become its organizer. Share the invite code so others can join."
      action={createGroup}
      submitLabel="Create group"
      pendingLabel="Creating…"
    >
      {(state) => (
        <Field
          label="Group name"
          name="name"
          maxLength={60}
          required
          autoFocus
          hint="For example, your club or the night you play."
          defaultValue={state.values?.name}
        />
      )}
    </ActionDialog>
  );
}

export function JoinGroupDialog({
  variant = "secondary",
}: {
  variant?: "primary" | "secondary";
}) {
  return (
    <ActionDialog
      trigger={{
        label: (
          <>
            <SignInIcon aria-hidden weight="bold" className="size-5" />
            Join group
          </>
        ),
        variant,
      }}
      title="Join a group"
      description="Ask an organizer or any member for the group's invite code."
      action={joinGroup}
      submitLabel="Join group"
      pendingLabel="Joining…"
    >
      {(state) => (
        <Field
          label="Invite code"
          name="code"
          required
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          defaultValue={state.values?.code}
        />
      )}
    </ActionDialog>
  );
}

const noSubscription = () => () => {};

/** Copies the code, or opens the share sheet where the device has one. */
export function InviteCodeActions({
  code,
  groupName,
}: {
  code: string;
  groupName: string;
}) {
  const [status, setStatus] = useState("");
  // False on the server, so the first client render matches the HTML.
  const canShare = useSyncExternalStore(
    noSubscription,
    () => "share" in navigator,
    () => false,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setStatus("Invite code copied.");
          } catch {
            setStatus("Could not copy. Select the code and copy it instead.");
          }
        }}
      >
        <CopyIcon aria-hidden weight="bold" className="size-4" />
        Copy code
      </Button>
      {canShare ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            navigator
              .share({
                title: `Join ${groupName} on Tenny`,
                text: `Join ${groupName} on Tenny with invite code ${code}.`,
              })
              .catch(() => undefined)
          }
        >
          <ShareNetworkIcon aria-hidden weight="bold" className="size-4" />
          Share
        </Button>
      ) : null}
      <span role="status" className="text-muted text-sm">
        {status}
      </span>
    </div>
  );
}

export function RotateInviteDialog({ groupId }: { groupId: string }) {
  return (
    <ActionDialog
      trigger={{ label: "New code", variant: "secondary", size: "sm" }}
      title="Create a new invite code?"
      description="The current code stops working immediately. Current members are not affected. The new code is valid for 30 days."
      action={rotateInvite}
      hidden={{ groupId }}
      submitLabel="Create new code"
      pendingLabel="Creating…"
    />
  );
}

type MemberAction = { groupId: string; userId: string; name: string };

export function RoleDialog({
  groupId,
  userId,
  name,
  role,
}: MemberAction & { role: string }) {
  const promote = role !== "organizer";
  return (
    <ActionDialog
      trigger={{
        label: promote ? "Make organizer" : "Make player",
        variant: "secondary",
        size: "sm",
      }}
      title={
        promote ? `Make ${name} an organizer?` : `Change ${name} to a player?`
      }
      description={
        promote
          ? "Organizers can manage members, rotate the invite code, and void matches."
          : "They will no longer be able to manage the group. A group always keeps at least one organizer."
      }
      action={setMemberRole}
      hidden={{ groupId, userId, role: promote ? "organizer" : "player" }}
      submitLabel={promote ? "Make organizer" : "Make player"}
      pendingLabel="Saving…"
    />
  );
}

export function RemoveMemberDialog({ groupId, userId, name }: MemberAction) {
  return (
    <ActionDialog
      trigger={{ label: "Remove", variant: "critical", size: "sm" }}
      title={`Remove ${name} from the group?`}
      description="Their results stay in the group's history and standings, marked as a former member. They cannot rejoin with the invite code unless an organizer restores them."
      action={removeMember}
      hidden={{ groupId, userId }}
      submitLabel="Remove member"
      submitVariant="critical"
      pendingLabel="Removing…"
    />
  );
}

export function RestoreMemberDialog({ groupId, userId, name }: MemberAction) {
  return (
    <ActionDialog
      trigger={{ label: "Restore", variant: "secondary", size: "sm" }}
      title={`Restore ${name}?`}
      description="They rejoin the active roster as a player, with their history intact."
      action={restoreMember}
      hidden={{ groupId, userId }}
      submitLabel="Restore member"
      pendingLabel="Restoring…"
    />
  );
}

export function TransferDialog({
  groupId,
  candidates,
}: {
  groupId: string;
  candidates: { id: string; name: string }[];
}) {
  return (
    <ActionDialog
      trigger={{ label: "Transfer organizer role", variant: "secondary" }}
      title="Hand over the organizer role"
      description="They become an organizer and you become a player. You cannot undo this yourself."
      action={transferOrganizer}
      hidden={{ groupId }}
      submitLabel="Transfer role"
      pendingLabel="Transferring…"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="successor"
          className="text-ink-strong text-sm font-semibold"
        >
          New organizer
        </label>
        <select
          id="successor"
          name="userId"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            Choose a member
          </option>
          {candidates.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </div>
    </ActionDialog>
  );
}

export function LeaveGroupDialog({
  groupId,
  groupName,
  lastOrganizer,
}: {
  groupId: string;
  groupName: string;
  lastOrganizer: boolean;
}) {
  return (
    <ActionDialog
      trigger={{ label: "Leave group", variant: "critical" }}
      title={`Leave ${groupName}?`}
      description={
        lastOrganizer
          ? "You are the only organizer. Transfer the role to another member before you leave."
          : "Your results stay in the group's history. You can rejoin later with the invite code."
      }
      action={leaveGroup}
      hidden={{ groupId }}
      submitLabel="Leave group"
      submitVariant="critical"
      pendingLabel="Leaving…"
    />
  );
}
