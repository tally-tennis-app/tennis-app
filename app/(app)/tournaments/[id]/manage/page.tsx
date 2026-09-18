import { notFound, redirect } from "next/navigation";

import {
  CancelTournamentDialog,
  DecideTieDialog,
  StartDialog,
  WithdrawDialog,
} from "@/src/components/tournaments/tournament-dialogs";
import { Alert } from "@/src/components/ui/feedback";
import { PageHeader, Panel, Section } from "@/src/components/ui/structure";
import { formatDate } from "@/src/lib/format";
import { getTournament } from "@/src/lib/tournaments/queries";
import { tieRoundName } from "@/src/lib/tournaments/types";

export const metadata = { title: "Manage tournament" };

// Hidden controls are not the boundary: each action is authorized again in
// its database function (require_tournament_organizer).
export default async function ManageTournamentPage({
  params,
}: PageProps<"/tournaments/[id]/manage">) {
  const { id } = await params;
  const detail = await getTournament(id);
  if (!detail) notFound();
  if (
    !detail.viewerIsOrganizer ||
    !["registration", "in_progress"].includes(detail.status)
  ) {
    redirect(`/tournaments/${detail.id}`);
  }

  const openTies = detail.ties.filter(
    (t) => !t.decidedBy && t.playerA && t.playerB,
  );
  const stillIn = detail.entrants.filter((e) => !e.out);

  return (
    <>
      <PageHeader
        title="Manage tournament"
        back={{ href: `/tournaments/${detail.id}`, label: detail.name }}
      />

      {detail.status === "registration" ? (
        <Section title="Entries">
          <Panel className="flex flex-col gap-4 p-5">
            <p>
              {detail.entrantCount} of {detail.entrantCap} entered
              {detail.entrants.length > 0
                ? `: ${detail.entrants.map((e) => e.player.name).join(", ")}.`
                : "."}
            </p>
            {detail.entrantCount >= 2 ? (
              <StartDialog
                tournamentId={detail.id}
                entrantCount={detail.entrantCount}
              />
            ) : (
              <Alert tone="info">
                At least two players must enter before you can make the draw.
              </Alert>
            )}
          </Panel>
        </Section>
      ) : null}

      {detail.status === "in_progress" ? (
        <>
          <Section title="Ties waiting for a result">
            {openTies.length === 0 ? (
              <p className="text-muted">
                Every tie with two players has a result.
              </p>
            ) : (
              <ul className="border-line bg-surface divide-line divide-y border">
                {openTies.map((tie) => (
                  <li
                    key={tie.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex flex-col">
                      <span className="text-ink-strong font-semibold">
                        {tie.playerA!.name} v {tie.playerB!.name}
                      </span>
                      <span className="text-muted text-sm">
                        {tieRoundName(tie.round, detail.rounds)}
                        {tie.deadline
                          ? `, due ${formatDate(tie.deadline)}`
                          : ""}
                        {tie.match ? ", result waiting for confirmation" : ""}
                      </span>
                    </span>
                    <DecideTieDialog
                      tournamentId={detail.id}
                      tieId={tie.id}
                      players={[tie.playerA!, tie.playerB!]}
                      round={tieRoundName(tie.round, detail.rounds)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Players still in">
            <ul className="border-line bg-surface divide-line divide-y border">
              {stillIn.map((entrant) => (
                <li
                  key={entrant.player.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-ink-strong font-semibold">
                    {entrant.player.name}
                  </span>
                  <WithdrawDialog
                    tournamentId={detail.id}
                    player={entrant.player}
                    own={false}
                  />
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}

      <Section title="Cancel">
        <Panel className="flex flex-col gap-3 p-5">
          <p className="text-muted">
            Stops the tournament for everyone. Confirmed results keep counting
            toward ratings.
          </p>
          <div>
            <CancelTournamentDialog tournamentId={detail.id} />
          </div>
        </Panel>
      </Section>
    </>
  );
}
