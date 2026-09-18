import { TrophyIcon } from "@phosphor-icons/react/ssr";

import { CreateTournamentForm } from "@/src/components/tournaments/create-form";
import { ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";
import { PageHeader } from "@/src/components/ui/structure";
import { asUuid } from "@/src/lib/forms";
import { listMyGroups } from "@/src/lib/groups/queries";

export const metadata = { title: "Create tournament" };

export default async function NewTournamentPage({
  searchParams,
}: PageProps<"/tournaments/new">) {
  const { group } = await searchParams;
  const groups = (await listMyGroups()).filter((g) => g.role === "organizer");

  return (
    <>
      <PageHeader
        title="Create a tournament"
        back={{ href: "/tournaments", label: "Tournaments" }}
        description="Single elimination, singles, within one group."
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={TrophyIcon}
          title="Only organizers can create tournaments"
          action={<ButtonLink href="/groups">Go to groups</ButtonLink>}
        >
          Ask an organizer of your group, or create a group of your own.
        </EmptyState>
      ) : (
        <CreateTournamentForm
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          preselect={asUuid(group)}
        />
      )}
    </>
  );
}
