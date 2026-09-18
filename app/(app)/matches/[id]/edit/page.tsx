import { notFound, redirect } from "next/navigation";

import { ScoreForm } from "@/src/components/matches/score-form";
import { Alert } from "@/src/components/ui/feedback";
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
  if (
    match.submitter.id !== viewer.id ||
    ["confirmed", "voided"].includes(match.status)
  ) {
    redirect(`/matches/${match.id}`);
  }

  return (
    <>
      <PageHeader
        title="Correct the score"
        back={{ href: `/matches/${match.id}`, label: "Match" }}
        description={`Against ${match.opponent.name} in ${match.group.name}.`}
      />
      {match.status === "rejected" && match.rejectionReason ? (
        <Alert tone="critical" title={`${match.opponent.name} said`}>
          “{match.rejectionReason}”
        </Alert>
      ) : null}
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
            sets: match.sets,
            winnerId: match.winnerId,
          }}
        />
      </div>
    </>
  );
}
