import { GearSixIcon, TrophyIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { registerForTournament } from "@/app/(app)/tournaments/actions";
import { Bracket } from "@/src/components/tournaments/bracket";
import { TournamentStatusBadge } from "@/src/components/tournaments/tournament-card";
import {
  UnregisterDialog,
  WithdrawDialog,
} from "@/src/components/tournaments/tournament-dialogs";
import { ActionButton } from "@/src/components/ui/action-button";
import { ButtonLink } from "@/src/components/ui/button";
import { Alert } from "@/src/components/ui/feedback";
import {
  Avatar,
  Badge,
  PageHeader,
  Panel,
  Section,
  TabNav,
} from "@/src/components/ui/structure";
import { formatDate } from "@/src/lib/format";
import { getViewer } from "@/src/lib/profiles/queries";
import { getTournament } from "@/src/lib/tournaments/queries";
import {
  tieRoundName,
  viewerNextTie,
  type TournamentDetail,
} from "@/src/lib/tournaments/types";

const TABS = ["overview", "draw", "entrants", "activity"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/tournaments/[id]">) {
  const { id } = await params;
  return { title: (await getTournament(id))?.name ?? "Tournament" };
}

export default async function TournamentPage({
  params,
  searchParams,
}: PageProps<"/tournaments/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const [detail, viewer] = await Promise.all([getTournament(id), getViewer()]);
  if (!detail) notFound();

  const defaultTab = detail.status === "registration" ? "overview" : "draw";
  const tab = TABS.find((t) => t === query.tab) ?? defaultTab;

  return (
    <>
      <PageHeader
        title={detail.name}
        back={{ href: "/tournaments", label: "Tournaments" }}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <TournamentStatusBadge status={detail.status} />
            <span>
              <Link href={`/groups/${detail.group.id}`} className="underline">
                {detail.group.name}
              </Link>{" "}
              · Single elimination
            </span>
          </span>
        }
        actions={
          detail.viewerIsOrganizer &&
          ["registration", "in_progress"].includes(detail.status) ? (
            <ButtonLink
              href={`/tournaments/${detail.id}/manage`}
              variant="secondary"
            >
              <GearSixIcon aria-hidden weight="bold" className="size-5" />
              Manage
            </ButtonLink>
          ) : null
        }
      />

      {query.created ? (
        <Alert tone="positive" title="Tournament created">
          Members of {detail.group.name} can enter now. Make the draw from
          Manage when everyone is in.
        </Alert>
      ) : null}

      <ViewerPanel detail={detail} viewerId={viewer.id} />

      <TabNav
        label="Tournament sections"
        current={tab}
        tabs={TABS.map((t) => ({
          key: t,
          label: t[0].toUpperCase() + t.slice(1),
          href: `/tournaments/${detail.id}?tab=${t}`,
        }))}
      />

      {tab === "overview" ? <Overview detail={detail} /> : null}
      {tab === "draw" ? (
        detail.rounds > 0 ? (
          <Bracket detail={detail} viewerId={viewer.id} />
        ) : (
          <p className="text-muted">
            The draw appears here once the organizer closes entries.
          </p>
        )
      ) : null}
      {tab === "entrants" ? (
        <Entrants detail={detail} viewerId={viewer.id} />
      ) : null}
      {tab === "activity" ? <Activity detail={detail} /> : null}
    </>
  );
}

function ViewerPanel({
  detail,
  viewerId,
}: {
  detail: TournamentDetail;
  viewerId: string;
}) {
  if (detail.status === "completed") {
    return (
      <Panel className="flex items-center gap-4 p-5">
        <TrophyIcon
          aria-hidden
          weight="fill"
          className="text-accent size-10 shrink-0"
        />
        <div>
          <p className="type-label text-muted">Champion</p>
          <p className="type-title">{detail.champion?.name ?? "No champion"}</p>
          {detail.completedAt ? (
            <p className="text-muted text-sm">
              Decided {formatDate(detail.completedAt)}
            </p>
          ) : null}
        </div>
      </Panel>
    );
  }

  if (detail.status === "cancelled") {
    return (
      <Alert tone="critical" title="This tournament was cancelled">
        {detail.cancelReason}
      </Alert>
    );
  }

  if (detail.status === "registration") {
    const full = detail.entrantCount >= detail.entrantCap;
    return (
      <Panel className="flex flex-col gap-3 p-5">
        <p className="type-section">
          {detail.viewerEntered
            ? "You are entered"
            : full
              ? "Entries are full"
              : "Entries are open"}
        </p>
        <p className="text-muted">
          {detail.entrantCount} of {detail.entrantCap} places taken. The draw is
          made when the organizer closes entries.
        </p>
        {detail.viewerEntered ? (
          <UnregisterDialog tournamentId={detail.id} />
        ) : !full ? (
          <ActionButton
            action={registerForTournament}
            hidden={{ tournamentId: detail.id }}
            label="Enter tournament"
            pendingLabel="Entering…"
          />
        ) : null}
      </Panel>
    );
  }

  const next = viewerNextTie(detail, viewerId);
  if (!next) {
    const entrant = detail.entrants.find((e) => e.player.id === viewerId);
    return entrant ? (
      <Alert tone="info">
        {entrant.withdrawnAt
          ? "You withdrew from this tournament."
          : "You are out of this tournament."}
      </Alert>
    ) : null;
  }

  const round = tieRoundName(next.tie.round, detail.rounds);
  const opponent = next.opponent?.name;
  const content = {
    play: {
      title: `Your ${round.toLowerCase()} against ${opponent}`,
      body: "Play your match, then log the score. Your opponent confirms it and the winner moves on.",
      action: (
        <ButtonLink href={`/tournaments/${detail.id}/ties/${next.tie.id}`}>
          Log the result
        </ButtonLink>
      ),
    },
    respond: {
      title: `${opponent} logged your ${round.toLowerCase()} result`,
      body: "Confirm it if it is right, or reject it so they can correct it.",
      action: next.tie.match ? (
        <ButtonLink href={`/matches/${next.tie.match.id}`}>
          Confirm or reject
        </ButtonLink>
      ) : null,
    },
    fix: {
      title: `${opponent} rejected your ${round.toLowerCase()} result`,
      body: "Correct the score and send it again.",
      action: next.tie.match ? (
        <ButtonLink href={`/matches/${next.tie.match.id}`}>
          Review result
        </ButtonLink>
      ) : null,
    },
    waiting: {
      title: `Waiting for ${opponent} to confirm`,
      body: "The winner moves on as soon as the result is confirmed.",
      action: null,
    },
    await: {
      title: `You are through to the ${round.toLowerCase()}`,
      body: "Your opponent is still being decided.",
      action: null,
    },
  }[next.state];

  return (
    <Panel
      className={`flex flex-col gap-3 p-5 ${["play", "respond", "fix"].includes(next.state) ? "border-accent border-l-4" : ""}`}
    >
      <p className="type-section">{content.title}</p>
      <p className="text-muted">
        {content.body}
        {next.tie.deadline
          ? ` Play by ${formatDate(next.tie.deadline)}.`
          : null}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {content.action}
        <WithdrawDialog tournamentId={detail.id} own />
      </div>
    </Panel>
  );
}

function Overview({ detail }: { detail: TournamentDetail }) {
  const facts: [string, string][] = [
    ["Format", "Single elimination, singles"],
    ["Entries", `${detail.entrantCount} of ${detail.entrantCap}`],
    [
      "Seeding",
      detail.seeding === "rating" ? "By group rating" : "Random draw",
    ],
    [
      "Each round",
      `${detail.roundDays} ${detail.roundDays === 1 ? "day" : "days"} to play`,
    ],
    ["Created", formatDate(detail.createdAt)],
    ...(detail.startedAt
      ? ([["Draw made", formatDate(detail.startedAt)]] as [string, string][])
      : []),
  ];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <Section title="Key facts">
        <dl className="border-line bg-surface divide-line divide-y border">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">{label}</dt>
              <dd className="text-ink-strong text-right font-semibold">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Rules">
        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5">
          <li>
            Lose once and you are out. The winner of the final is champion.
          </li>
          <li>
            Each tie is an ordinary match: one player logs it, the other
            confirms it.
          </li>
          <li>
            Results count toward ratings like any other match. Walkovers are not
            rated.
          </li>
          <li>If a player withdraws, their opponent moves on.</li>
          <li>
            For a tie nobody played, the organizer awards a walkover or puts
            both players out.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Entrants({
  detail,
  viewerId,
}: {
  detail: TournamentDetail;
  viewerId: string;
}) {
  if (detail.entrants.length === 0) {
    return <p className="text-muted">No one has entered yet.</p>;
  }
  return (
    <ol className="border-line bg-surface divide-line divide-y border">
      {detail.entrants.map((entrant) => (
        <li
          key={entrant.player.id}
          className="flex min-h-14 items-center gap-3 px-4 py-2"
        >
          <span className="type-score text-muted w-6 text-right">
            {entrant.seed ?? ""}
          </span>
          <Avatar name={entrant.player.name} size="sm" muted={entrant.out} />
          <Link
            href={`/players/${entrant.player.id}`}
            className="text-ink-strong min-w-0 flex-1 truncate font-semibold hover:underline"
          >
            {entrant.player.name}
            {entrant.player.id === viewerId ? " (you)" : ""}
          </Link>
          {entrant.withdrawnAt ? (
            <Badge>Withdrew</Badge>
          ) : entrant.out ? (
            <Badge>Out</Badge>
          ) : detail.champion?.id === entrant.player.id ? (
            <Badge tone="accent">Champion</Badge>
          ) : detail.status === "in_progress" ? (
            <Badge tone="positive">Still in</Badge>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Activity({ detail }: { detail: TournamentDetail }) {
  if (detail.events.length === 0)
    return <p className="text-muted">Nothing recorded yet.</p>;
  return (
    <ol className="border-line flex flex-col gap-4 border-l-2 pl-5">
      {detail.events.map((event) => (
        <li key={event.id} className="flex flex-col gap-0.5">
          <span className="text-ink-strong font-semibold">
            {event.detail ?? event.kind}
          </span>
          <span className="text-muted text-sm">{formatDate(event.at)}</span>
        </li>
      ))}
    </ol>
  );
}
