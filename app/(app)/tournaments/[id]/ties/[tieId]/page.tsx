import { notFound, redirect } from "next/navigation";

import { ScoreForm } from "@/src/components/matches/score-form";
import { PageHeader } from "@/src/components/ui/structure";
import { todayIso } from "@/src/lib/format";
import { getViewer } from "@/src/lib/profiles/queries";
import { getTournament } from "@/src/lib/tournaments/queries";
import { tieRoundName, viewerNextTie } from "@/src/lib/tournaments/types";

export const metadata = { title: "Log a tournament result" };

export default async function TieResultPage({
  params,
}: PageProps<"/tournaments/[id]/ties/[tieId]">) {
  const { id, tieId } = await params;
  const [detail, viewer] = await Promise.all([getTournament(id), getViewer()]);
  if (!detail) notFound();

  // The database enforces this too; here it avoids offering a dead form.
  const next = viewerNextTie(detail, viewer.id);
  if (
    !next ||
    next.tie.id !== tieId ||
    next.state !== "play" ||
    !next.opponent
  ) {
    redirect(`/tournaments/${detail.id}`);
  }

  return (
    <>
      <PageHeader
        title={`${tieRoundName(next.tie.round, detail.rounds)} result`}
        back={{ href: `/tournaments/${detail.id}`, label: detail.name }}
        description={`Against ${next.opponent.name}. They confirm it, then the winner moves on.`}
      />
      <div className="max-w-prose">
        <ScoreForm
          viewer={{ id: viewer.id, name: viewer.displayName }}
          today={todayIso()}
          requestId={crypto.randomUUID()}
          tie={{
            id: next.tie.id,
            group: detail.group,
            opponent: next.opponent,
            format: detail.format,
          }}
        />
      </div>
    </>
  );
}
