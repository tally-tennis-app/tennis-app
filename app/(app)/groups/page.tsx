import { CaretRightIcon, UsersThreeIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import {
  CreateGroupDialog,
  JoinGroupDialog,
} from "@/src/components/groups/group-dialogs";
import { Alert, EmptyState } from "@/src/components/ui/feedback";
import { PageHeader, RoleBadge } from "@/src/components/ui/structure";
import { listMyGroupsWithRoster } from "@/src/lib/groups/queries";

export const metadata = { title: "Groups" };

export default async function GroupsPage({
  searchParams,
}: PageProps<"/groups">) {
  const { left } = await searchParams;
  const groups = await listMyGroupsWithRoster();

  return (
    <>
      <PageHeader
        title="Groups"
        description="Matches and standings happen within a group."
        actions={
          groups.length > 0 ? (
            <>
              <CreateGroupDialog />
              <JoinGroupDialog />
            </>
          ) : null
        }
      />

      {left ? <Alert tone="positive">You left the group.</Alert> : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersThreeIcon}
          title="You are not in a group yet"
          action={
            <>
              <JoinGroupDialog variant="primary" />
              <CreateGroupDialog variant="secondary" />
            </>
          }
        >
          Got an invite code from a friend? Join their group. Starting one for
          your club? Create it and share the code.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="border-line bg-surface hover:border-line-strong flex items-center justify-between gap-4 border p-5 transition-colors"
              >
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="type-section truncate">{group.name}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <RoleBadge role={group.role} />
                    <span className="text-muted text-sm">
                      {group.members.length}{" "}
                      {group.members.length === 1 ? "member" : "members"}
                    </span>
                  </span>
                </span>
                <CaretRightIcon
                  aria-hidden
                  weight="bold"
                  className="text-muted size-5 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
