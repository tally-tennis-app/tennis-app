import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretRightIcon,
  CheckIcon,
  ClockCountdownIcon,
  HourglassMediumIcon,
  ProhibitIcon,
  SealCheckIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { Badge } from "@/src/components/ui/structure";
import { formatDelta, formatPlayedOn } from "@/src/lib/format";
import { formatLabel, formatScore, type Side } from "@/src/lib/matches/score";
import {
  sideOf,
  viewerAction,
  type MatchStatus,
  type MatchView,
} from "@/src/lib/matches/types";

const statusBadges = {
  pending: {
    tone: "warning",
    icon: HourglassMediumIcon,
    label: "Awaiting confirmation",
  },
  confirmed: { tone: "positive", icon: SealCheckIcon, label: "Confirmed" },
  rejected: { tone: "critical", icon: XCircleIcon, label: "Rejected" },
  expired: { tone: "neutral", icon: ClockCountdownIcon, label: "Expired" },
  voided: { tone: "neutral", icon: ProhibitIcon, label: "Voided" },
} as const;

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const { tone, icon, label } = statusBadges[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

/** A signed number with an arrow, so direction never relies on colour. */
export function RatingDelta({ value }: { value: number }) {
  const rounded = Math.round(value);
  const Arrow = rounded >= 0 ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span
      className={`type-score inline-flex items-center gap-0.5 text-sm ${
        rounded > 0
          ? "text-positive"
          : rounded < 0
            ? "text-critical"
            : "text-muted"
      }`}
    >
      {rounded !== 0 ? (
        <Arrow aria-hidden weight="bold" className="size-3.5" />
      ) : null}
      {formatDelta(value)}
    </span>
  );
}

/** "Ada beat Bo 6-4 3-6 7-6(5)", the sentence a screen reader hears. */
export function describeMatch(match: MatchView) {
  const winnerSide: Side = match.winnerId === match.submitter.id ? "a" : "b";
  const [winner, loser] =
    winnerSide === "a"
      ? [match.submitter, match.opponent]
      : [match.opponent, match.submitter];

  const shape =
    match.format === "match"
      ? ""
      : ` (${formatLabel(match.format, match.sets[0]?.target)})`;

  if (match.outcome === "walkover") {
    return `${winner.name} won by walkover against ${loser.name}${shape}`;
  }

  const score = formatScore(match.sets, winnerSide);
  const retired = match.outcome === "retired" ? `, ${loser.name} retired` : "";
  return `${winner.name} beat ${loser.name} ${score}${shape}${retired}`.trim();
}

/**
 * The score hierarchy from nextsteps.md: names, then set scores, then state,
 * then the action. The winner is marked with weight and a "Won" check, never
 * by colour alone.
 */
export function Scoreline({
  match,
  size = "md",
}: {
  match: MatchView;
  size?: "md" | "lg";
}) {
  const rows: { side: Side; name: string; id: string }[] = [
    { side: "a", name: match.submitter.name, id: match.submitter.id },
    { side: "b", name: match.opponent.name, id: match.opponent.id },
  ];
  const games = size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl";
  const cell = size === "lg" ? "w-10 sm:w-12" : "w-8";

  return (
    <div role="group" aria-label={describeMatch(match)}>
      <div aria-hidden className="flex flex-col gap-2">
        {rows.map(({ side, name, id }) => {
          const won = match.winnerId === id;
          const retiredHere = match.outcome === "retired" && !won;
          return (
            <div key={side} className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={`truncate ${size === "lg" ? "text-xl" : "text-base"} ${
                    won ? "text-ink-strong font-bold" : "text-muted"
                  }`}
                >
                  {name}
                </span>
                {won ? (
                  <span className="text-positive inline-flex shrink-0 items-center gap-0.5 text-xs font-bold uppercase">
                    <CheckIcon weight="bold" className="size-3.5" />
                    Won
                  </span>
                ) : null}
                {retiredHere ? (
                  <span className="text-muted shrink-0 text-xs font-semibold uppercase">
                    Retired
                  </span>
                ) : null}
              </div>
              {match.outcome === "walkover" ? null : (
                <div className="flex shrink-0">
                  {match.sets.map((set, index) => {
                    const mine = side === "a" ? set.a : set.b;
                    const theirs = side === "a" ? set.b : set.a;
                    const tookSet = mine > theirs;
                    return (
                      <span
                        key={index}
                        className={`type-score relative text-center ${cell} ${games} ${
                          tookSet
                            ? "text-ink-strong"
                            : "text-muted font-semibold"
                        }`}
                      >
                        {mine}
                        {set.tiebreak != null && !tookSet ? (
                          <sup className="absolute top-0 -right-0.5 text-[0.45em] font-bold">
                            {set.tiebreak}
                          </sup>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {match.outcome === "walkover" ? (
        <p aria-hidden className="type-label text-muted mt-2">
          Walkover, not rated
        </p>
      ) : null}
    </div>
  );
}

const actionLabels = {
  confirm: "Confirm or reject",
  waiting: "Waiting for opponent",
} as const;

export function MatchCard({
  match,
  viewerId,
  href = `/matches/${match.id}`,
  size = "md",
}: {
  match: MatchView;
  viewerId?: string;
  href?: string | null;
  size?: "md" | "lg";
}) {
  const action = viewerId ? viewerAction(match, viewerId) : null;
  const viewerSide = viewerId ? sideOf(match, viewerId) : null;
  const delta = viewerId ? match.ratingDeltas[viewerId] : undefined;
  const needsViewer = action === "confirm";

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <MatchStatusBadge status={match.status} />
          {match.format === "match" ? null : (
            <Badge tone="neutral">
              {formatLabel(match.format, match.sets[0]?.target)}
            </Badge>
          )}
        </span>
        <p className="type-meta">
          {match.tournament
            ? `${match.tournament.name}, ${match.tournament.round}`
            : match.group.name}{" "}
          · {formatPlayedOn(match.playedOn)}
        </p>
      </div>
      <Scoreline match={match} size={size} />
      {action || (viewerSide && delta !== undefined) ? (
        <div className="border-line flex items-center justify-between gap-3 border-t pt-3 text-sm">
          <span className="flex items-center gap-2">
            {viewerSide && delta !== undefined ? (
              <>
                <span className="text-muted">Your rating</span>
                <RatingDelta value={delta} />
              </>
            ) : action ? (
              <span
                className={
                  needsViewer ? "text-ink-strong font-semibold" : "text-muted"
                }
              >
                {actionLabels[action]}
              </span>
            ) : null}
          </span>
          {href ? (
            <CaretRightIcon
              aria-hidden
              weight="bold"
              className="text-muted size-4"
            />
          ) : null}
        </div>
      ) : null}
    </>
  );

  const frame = `bg-surface flex flex-col gap-4 border ${size === "lg" ? "p-5 sm:p-6" : "p-4"} ${
    needsViewer ? "border-accent border-l-4" : "border-line"
  }`;

  return href ? (
    <Link
      href={href}
      className={`${frame} hover:border-line-strong transition-colors`}
    >
      {body}
    </Link>
  ) : (
    <article className={frame}>{body}</article>
  );
}
