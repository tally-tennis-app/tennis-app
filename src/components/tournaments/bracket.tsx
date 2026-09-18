import { CheckIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { MatchStatusBadge } from "@/src/components/matches/match-card";
import { formatPlayedOn } from "@/src/lib/format";
import { formatScore } from "@/src/lib/matches/score";
import {
  decidedByLabels,
  roundName,
  type Person,
  type Tie,
  type TournamentDetail,
} from "@/src/lib/tournaments/types";

function scoreFor(tie: Tie, player: Person | null) {
  const match = tie.match;
  if (!match || !player || match.outcome === "walkover") return null;
  // Games from this row's player's point of view, e.g. "6 4 7".
  const side = match.submitter.id === player.id ? "a" : "b";
  return match.sets.map((set) => (side === "a" ? set.a : set.b)).join(" ");
}

function PlayerRow({
  tie,
  player,
  seeds,
  viewerId,
}: {
  tie: Tie;
  player: Person | null;
  seeds: Map<string, number | null>;
  viewerId: string;
}) {
  const won = Boolean(player && tie.winnerId === player.id);
  const seed = player ? seeds.get(player.id) : null;
  const score =
    tie.match?.status === "confirmed" ? scoreFor(tie, player) : null;

  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className="text-muted w-5 shrink-0 text-right text-xs tabular-nums">
        {seed ?? ""}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${
          player
            ? won
              ? "text-ink-strong font-bold"
              : "text-ink"
            : "text-muted italic"
        }`}
      >
        {player ? player.name : tie.decidedBy ? "Bye" : "To be decided"}
        {player?.id === viewerId ? " (you)" : ""}
      </span>
      {won ? (
        <span className="text-positive inline-flex shrink-0 items-center gap-0.5 text-xs font-bold uppercase">
          <CheckIcon aria-hidden weight="bold" className="size-3.5" />
          Won
        </span>
      ) : null}
      {score ? (
        <span className="type-score shrink-0 text-sm">{score}</span>
      ) : null}
    </div>
  );
}

function tieSummary(tie: Tie) {
  const a = tie.playerA?.name ?? "to be decided";
  const b = tie.playerB?.name ?? "to be decided";
  const winner = [tie.playerA, tie.playerB].find(
    (p) => p && p.id === tie.winnerId,
  );
  if (tie.decidedBy) {
    if (tie.decidedBy === "match" && tie.match && winner) {
      const side = tie.match.submitter.id === winner.id ? "a" : "b";
      return `${winner.name} won, ${formatScore(tie.match.sets, side)}`;
    }
    return winner
      ? `${winner.name} advanced: ${decidedByLabels[tie.decidedBy].toLowerCase()}`
      : "Neither player advanced";
  }
  return `${a} against ${b}`;
}

/**
 * Rounds as columns that scroll sideways on a phone, with a round selector.
 * The same markup is the accessible round-by-round list: each round is a
 * labelled section holding an ordered list of ties.
 */
export function Bracket({
  detail,
  viewerId,
}: {
  detail: TournamentDetail;
  viewerId: string;
}) {
  const seeds = new Map(detail.entrants.map((e) => [e.player.id, e.seed]));
  const rounds = Array.from({ length: detail.rounds }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Jump to round"
        className="flex flex-wrap gap-2 lg:hidden"
      >
        {rounds.map((round) => (
          <a
            key={round}
            href={`#round-${round}`}
            className="border-line-strong bg-surface inline-flex min-h-11 items-center border px-3 text-sm font-semibold"
          >
            {roundName(round, detail.rounds)}
          </a>
        ))}
      </nav>

      <div className="relative -mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-4">
          {rounds.map((round) => {
            const ties = detail.ties.filter((t) => t.round === round);
            const deadline = ties[0]?.deadline;
            return (
              <section
                key={round}
                id={`round-${round}`}
                aria-labelledby={`round-${round}-title`}
                className="flex w-[17rem] shrink-0 snap-start scroll-mt-20 flex-col gap-3"
              >
                <div>
                  <h3 id={`round-${round}-title`} className="type-section">
                    {roundName(round, detail.rounds)}
                  </h3>
                  {deadline && detail.status === "in_progress" ? (
                    <p className="type-meta">
                      Play by {formatPlayedOn(deadline)}
                    </p>
                  ) : null}
                </div>
                <ol className="flex flex-1 flex-col justify-around gap-3">
                  {ties.map((tie) => {
                    const viewerTie =
                      tie.playerA?.id === viewerId ||
                      tie.playerB?.id === viewerId;
                    const body = (
                      <>
                        <span className="sr-only">{tieSummary(tie)}</span>
                        <div aria-hidden className="flex flex-col">
                          <PlayerRow
                            tie={tie}
                            player={tie.playerA}
                            seeds={seeds}
                            viewerId={viewerId}
                          />
                          <div className="border-line border-t" />
                          <PlayerRow
                            tie={tie}
                            player={tie.playerB}
                            seeds={seeds}
                            viewerId={viewerId}
                          />
                        </div>
                        {tie.decidedBy && tie.decidedBy !== "match" ? (
                          <p aria-hidden className="type-label text-muted mt-1">
                            {decidedByLabels[tie.decidedBy]}
                          </p>
                        ) : !tie.decidedBy && tie.match ? (
                          <div aria-hidden className="mt-2">
                            <MatchStatusBadge status={tie.match.status} />
                          </div>
                        ) : null}
                      </>
                    );
                    const frame = `bg-surface block border px-3 py-2 ${
                      viewerTie && !tie.decidedBy
                        ? "border-accent border-l-4"
                        : "border-line"
                    }`;
                    return (
                      <li key={tie.id}>
                        {tie.match ? (
                          <Link
                            href={`/matches/${tie.match.id}`}
                            className={`${frame} hover:border-line-strong`}
                          >
                            {body}
                          </Link>
                        ) : (
                          <div className={frame}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
