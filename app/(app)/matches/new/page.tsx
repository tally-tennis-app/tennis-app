import { UsersThreeIcon } from "@phosphor-icons/react/ssr";

import { ScoreForm } from "@/src/components/matches/score-form";
import { ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";
import { PageHeader } from "@/src/components/ui/structure";
import { todayIso } from "@/src/lib/format";
import { asUuid } from "@/src/lib/forms";
import { listMyGroupsWithRoster } from "@/src/lib/groups/queries";
import { getViewer } from "@/src/lib/profiles/queries";

export const metadata = { title: "Log a match" };

export default async function NewMatchPage({
  searchParams,
}: PageProps<"/matches/new">) {
  const { group } = await searchParams;
  const [viewer, groups] = await Promise.all([
    getViewer(),
    listMyGroupsWithRoster(),
  ]);

  return (
    <>
      <PageHeader
        title="Log a match"
        back={{ href: "/matches", label: "Matches" }}
        description="Your opponent confirms the score before it counts."
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={UsersThreeIcon}
          title="Join a group first"
          action={<ButtonLink href="/groups">Go to groups</ButtonLink>}
        >
          Matches are logged within a group, so you and your opponent need to be
          in one together.
        </EmptyState>
      ) : (
        <div className="max-w-prose">
          <ScoreForm
            viewer={{ id: viewer.id, name: viewer.displayName }}
            groups={groups}
            // A fresh id per page load makes a retried submission idempotent.
            requestId={crypto.randomUUID()}
            today={todayIso()}
            preselectGroup={asUuid(group)}
          />
        </div>
      )}
    </>
  );
}
