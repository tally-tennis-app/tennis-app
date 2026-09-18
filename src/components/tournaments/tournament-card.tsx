import {
  CaretRightIcon,
  DoorOpenIcon,
  PlayIcon,
  ProhibitIcon,
  TrophyIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { Badge } from "@/src/components/ui/structure";
import { formatDate } from "@/src/lib/format";
import type {
  TournamentStatus,
  TournamentSummary,
} from "@/src/lib/tournaments/types";

const statusBadges = {
  registration: { tone: "accent", icon: DoorOpenIcon, label: "Open for entry" },
  in_progress: { tone: "positive", icon: PlayIcon, label: "In progress" },
  completed: { tone: "neutral", icon: TrophyIcon, label: "Completed" },
  cancelled: { tone: "critical", icon: ProhibitIcon, label: "Cancelled" },
} as const;

export function TournamentStatusBadge({
  status,
}: {
  status: TournamentStatus;
}) {
  const { tone, icon, label } = statusBadges[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

export function tournamentContext(t: TournamentSummary) {
  switch (t.status) {
    case "registration":
      return `${t.entrantCount} of ${t.entrantCap} entered`;
    case "in_progress":
      return `${t.entrantCount} players · started ${formatDate(t.startedAt!)}`;
    case "completed":
      return t.champion ? `Champion: ${t.champion.name}` : "Completed";
    case "cancelled":
      return `Cancelled ${formatDate(t.cancelledAt!)}`;
  }
}

export function TournamentCard({
  tournament,
}: {
  tournament: TournamentSummary;
}) {
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="border-line bg-surface hover:border-line-strong flex items-center justify-between gap-4 border p-5 transition-colors"
    >
      <span className="flex min-w-0 flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <TournamentStatusBadge status={tournament.status} />
          {tournament.viewerEntered ? (
            <Badge tone="accent">Entered</Badge>
          ) : null}
        </span>
        <span className="type-section truncate">{tournament.name}</span>
        <span className="type-meta">
          {tournament.group.name} · Single elimination
        </span>
        <span className="text-ink text-sm font-semibold">
          {tournamentContext(tournament)}
        </span>
      </span>
      <CaretRightIcon
        aria-hidden
        weight="bold"
        className="text-muted size-5 shrink-0"
      />
    </Link>
  );
}
