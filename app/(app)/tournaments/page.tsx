import { PlusIcon, TrophyIcon } from "@phosphor-icons/react/ssr";

import { TournamentCard } from "@/src/components/tournaments/tournament-card";
import { ButtonLink } from "@/src/components/ui/button";
import { Alert, EmptyState } from "@/src/components/ui/feedback";
import { PageHeader, Section } from "@/src/components/ui/structure";
import { listMyGroups } from "@/src/lib/groups/queries";
import { getViewer } from "@/src/lib/profiles/queries";
import { getTournament, listTournaments } from "@/src/lib/tournaments/queries";
import {
  viewerNextTie,
  type TournamentSummary,
} from "@/src/lib/tournaments/types";

export const metadata = { title: "Tournaments" };

function Grid({ items }: { items: TournamentSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((t) => (
        <li key={t.id}>
          <TournamentCard tournament={t} />
        </li>
      ))}
    </ul>
  );
}

export default async function TournamentsPage() {
  const [viewer, tournaments, groups] = await Promise.all([
    getViewer(),
    listTournaments(),
    listMyGroups(),
  ]);
  const canCreate = groups.some((g) => g.role === "organizer");

  // "Needs you": an active tournament where the viewer's tie wants something.
  const active = tournaments.filter((t) => t.status === "in_progress");
  const needsYou = (
    await Promise.all(
      active
        .filter((t) => t.viewerEntered)
        .map(async (t) => {
          const detail = await getTournament(t.id);
          const next = detail ? viewerNextTie(detail, viewer.id) : null;
          return next && ["play", "respond", "fix"].includes(next.state)
            ? t
            : null;
        }),
    )
  ).filter((t): t is TournamentSummary => t !== null);
  const needsIds = new Set(needsYou.map((t) => t.id));

  const open = tournaments.filter((t) => t.status === "registration");
  const running = active.filter((t) => !needsIds.has(t.id));
  const finished = tournaments.filter(
    (t) => t.status === "completed" || t.status === "cancelled",
  );

  return (
    <>
      <PageHeader
        title="Tournaments"
        description="Single-elimination events within your groups. Every result is a verified match."
        actions={
          canCreate ? (
            <ButtonLink href="/tournaments/new">
              <PlusIcon aria-hidden weight="bold" className="size-5" />
              Create tournament
            </ButtonLink>
          ) : null
        }
      />

      {tournaments.length === 0 ? (
        <EmptyState
          icon={TrophyIcon}
          title="No tournaments yet"
          action={
            canCreate ? (
              <ButtonLink href="/tournaments/new">Create tournament</ButtonLink>
            ) : null
          }
        >
          {canCreate
            ? "Run a knockout for one of your groups. Players enter, you make the draw, and results advance winners automatically."
            : "When an organizer in one of your groups opens a tournament, it appears here for you to enter."}
        </EmptyState>
      ) : null}

      {needsYou.length > 0 ? (
        <Section title="Needs you" id="needs-you">
          <Alert tone="warning">
            You have a tournament match to play or a result to answer.
          </Alert>
          <Grid items={needsYou} />
        </Section>
      ) : null}
      {open.length > 0 ? (
        <Section title="Open for entry" id="open">
          <Grid items={open} />
        </Section>
      ) : null}
      {running.length > 0 ? (
        <Section title="In progress" id="active">
          <Grid items={running} />
        </Section>
      ) : null}
      {finished.length > 0 ? (
        <Section title="Finished" id="finished">
          <Grid items={finished} />
        </Section>
      ) : null}
    </>
  );
}
