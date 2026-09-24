import { notFound, redirect } from "next/navigation";

import { ScoreForm } from "@/src/components/matches/score-form";
import { PageHeader } from "@/src/components/ui/structure";
import { todayIso } from "@/src/lib/format";
import { getMatch } from "@/src/lib/matches/queries";
import { getViewer } from "@/src/lib/profiles/queries";

export const metadata = { title: "Edit match" };

export default async function EditMatchPage({
  params,
}: PageProps<"/matches/[id]/edit">) {
  const { id } = await params;
  const [match, viewer] = await Promise.all([getMatch(id), getViewer()]);

  if (!match) notFound();
  // The database refuses these edits anyway; this just avoids a dead form.
  if (match.submitter.id !== viewer.id || match.status !== "pending") {
    redirect(`/matches/${match.id}`);
  }

  return (
    <>
      <PageHeader
        title="Edit the score"
        back={{ href: `/matches/${match.id}`, label: "Match" }}
        description={`Against ${match.opponent.name} in ${match.group.name}.`}
      />
      <div className="max-w-prose">
        <ScoreForm
          viewer={{ id: viewer.id, name: viewer.displayName }}
          today={todayIso()}
          initial={{
            matchId: match.id,
            group: match.group,
            opponent: match.opponent,
            playedOn: match.playedOn,
            outcome: match.outcome,
            format: match.format,
            sets: match.sets,
            winnerId: match.winnerId,
          }}
        />
      </div>
    </>
  );
}
