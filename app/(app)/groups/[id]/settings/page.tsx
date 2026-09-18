import { notFound } from "next/navigation";

import {
  InviteCodeActions,
  LeaveGroupDialog,
  RemoveMemberDialog,
  RestoreMemberDialog,
  RoleDialog,
  RotateInviteDialog,
  TransferDialog,
} from "@/src/components/groups/group-dialogs";
import {
  Avatar,
  PageHeader,
  Panel,
  RoleBadge,
  Section,
} from "@/src/components/ui/structure";
import { formatDate } from "@/src/lib/format";
import { getGroup } from "@/src/lib/groups/queries";

export const metadata = { title: "Group settings" };

// Hiding a control is not a security boundary: every action here is
// authorized again inside its database function.
export default async function GroupSettingsPage({
  params,
}: PageProps<"/groups/[id]/settings">) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const active = group.members.filter((m) => !m.leftAt);
  const departed = group.members.filter((m) => m.leftAt);
  const others = active.filter((m) => m.userId !== group.viewerId);
  const organizerCount = active.filter((m) => m.role === "organizer").length;
  const lastOrganizer = group.viewerIsOrganizer && organizerCount === 1;
  const expired = group.inviteExpired;

  return (
    <>
      <PageHeader
        title={group.viewerIsOrganizer ? "Manage group" : "Group settings"}
        back={{ href: `/groups/${group.id}`, label: group.name }}
      />

      <Section title="Invite code">
        <Panel className="flex flex-col gap-3 p-5">
          <p className="type-code text-ink-strong text-2xl">
            {group.inviteCode}
          </p>
          <p className="text-muted text-sm">
            {expired
              ? `Expired on ${formatDate(group.inviteExpiresAt)}. New players cannot join until an organizer creates a new code.`
              : `Valid until ${formatDate(group.inviteExpiresAt)}. Expiry only stops new joins; members stay.`}
          </p>
          <div className="flex flex-wrap gap-3">
            {!expired ? (
              <InviteCodeActions
                code={group.inviteCode}
                groupName={group.name}
              />
            ) : null}
            {group.viewerIsOrganizer ? (
              <RotateInviteDialog groupId={group.id} />
            ) : null}
          </div>
        </Panel>
      </Section>

      {group.viewerIsOrganizer ? (
        <Section title="Members">
          <ul className="border-line bg-surface divide-line divide-y border">
            {active.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <Avatar name={member.displayName} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ink-strong truncate font-semibold">
                    {member.displayName}
                    {member.userId === group.viewerId ? " (you)" : ""}
                  </span>
                  <span className="text-muted text-sm">
                    Joined {formatDate(member.joinedAt)}
                  </span>
                </span>
                <RoleBadge role={member.role} />
                {member.userId !== group.viewerId ? (
                  <span className="flex flex-wrap gap-2">
                    <RoleDialog
                      groupId={group.id}
                      userId={member.userId}
                      name={member.displayName}
                      role={member.role}
                    />
                    <RemoveMemberDialog
                      groupId={group.id}
                      userId={member.userId}
                      name={member.displayName}
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {group.viewerIsOrganizer && departed.length > 0 ? (
        <Section title="Former members">
          <p className="text-muted text-sm">
            Someone an organizer removed cannot rejoin with the invite code
            until they are restored.
          </p>
          <ul className="border-line bg-surface divide-line divide-y border">
            {departed.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <Avatar name={member.displayName} size="sm" muted />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ink truncate font-semibold">
                    {member.displayName}
                  </span>
                  <span className="text-muted text-sm">
                    {member.wasRemoved ? "Removed" : "Left"}{" "}
                    {formatDate(member.leftAt!)}
                  </span>
                </span>
                <RestoreMemberDialog
                  groupId={group.id}
                  userId={member.userId}
                  name={member.displayName}
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={group.viewerIsOrganizer ? "Your role" : "Membership"}>
        <Panel className="flex flex-col gap-4 p-5">
          {group.viewerIsOrganizer ? (
            <p className="text-muted">
              {lastOrganizer
                ? "You are the only organizer. Hand the role to another member before you leave."
                : `This group has ${organizerCount} organizers.`}
            </p>
          ) : (
            <p className="text-muted">
              Leaving keeps your results in the group&apos;s history. You can
              rejoin later with the invite code.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {group.viewerIsOrganizer && others.length > 0 ? (
              <TransferDialog
                groupId={group.id}
                candidates={others.map((m) => ({
                  id: m.userId,
                  name: m.displayName,
                }))}
              />
            ) : null}
            <LeaveGroupDialog
              groupId={group.id}
              groupName={group.name}
              lastOrganizer={lastOrganizer}
            />
          </div>
        </Panel>
      </Section>
    </>
  );
}
