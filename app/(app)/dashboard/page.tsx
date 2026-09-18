import {
  PlusIcon,
  TennisBallIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

import {
  CreateGroupDialog,
  JoinGroupDialog,
} from "@/src/components/groups/group-dialogs";
import { MatchCard, RatingDelta } from "@/src/components/matches/match-card";
import { StandingsTable } from "@/src/components/ratings/standings-table";
import { ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";
import {
  Panel,
  Section,
  StatTile,
  TabNav,
} from "@/src/components/ui/structure";
import { formatRating } from "@/src/lib/format";
import { asUuid } from "@/src/lib/forms";
import { listMyGroups } from "@/src/lib/groups/queries";
import { listMatches, listOpenMatches } from "@/src/lib/matches/queries";
import { getViewer } from "@/src/lib/profiles/queries";
import { getStandings } from "@/src/lib/ratings/queries";
import { ordinal } from "@/src/lib/ratings/types";
import { getTournament, listTournaments } from "@/src/lib/tournaments/queries";
import { tieRoundName, viewerNextTie } from "@/src/lib/tournaments/types";

export const metadata = { title: "Home" };

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const { group: requested } = await searchParams;
  const viewer = await getViewer();
  const groups = await listMyGroups();
  const firstName = viewer.displayName.split(/\s+/)[0];

  if (groups.length === 0) {
    return (
      <>
        <h1 className="type-title">Welcome to Tenny, {firstName}</h1>
        <EmptyState
          icon={UsersThreeIcon}
          title="Start with a group"
          action={
            <>
              <JoinGroupDialog variant="primary" />
              <CreateGroupDialog variant="secondary" />
            </>
          }
        >
          Every match belongs to a group: your club, your ladder, or the friends
          you play with. Join one with an invite code, or create one and share
          its code.
        </EmptyState>
      </>
    );
  }

  const group = groups.find((g) => g.id === asUuid(requested)) ?? groups[0];
  const [open, recent, overall, groupStandings, tournaments] =
    await Promise.all([
      listOpenMatches(viewer.id),
      listMatches({ playerId: viewer.id, status: "confirmed" }, { limit: 3 }),
      getStandings(),
      getStandings(group.id),
      listTournaments(),
    ]);

  // Tournament pulse: where the viewer stands in each event they are still in.
  const pulse = (
    await Promise.all(
      tournaments
        .filter((t) => t.status === "in_progress" && t.viewerEntered)
        .map(async (t) => {
          const detail = await getTournament(t.id);
          const next = detail ? viewerNextTie(detail, viewer.id) : null;
          return detail && next ? { detail, next } : null;
        }),
    )
  ).filter((item) => item !== null);
  const openForEntry = tournaments.filter(
    (t) => t.status === "registration" && !t.viewerEntered,
  );

  const me = overall.rated.find((row) => row.playerId === viewer.id);
  const groupMe = groupStandings.rated.find(
    (row) => row.playerId === viewer.id,
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="type-title">Hi, {firstName}</h1>
        <ButtonLink href="/matches/new" className="max-lg:hidden">
          <PlusIcon aria-hidden weight="bold" className="size-5" />
          Log a match
        </ButtonLink>
      </div>

      {open.needsYou.length > 0 ? (
        <Section
          title={
            open.needsYou.length === 1
              ? "1 match needs you"
              : `${open.needsYou.length} matches need you`
          }
          id="needs-you"
          action={
            open.needsYou.length > 2 ? (
              <Link
                href="/matches#needs-you"
                className="text-sm font-semibold underline"
              >
                See all
              </Link>
            ) : null
          }
        >
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {open.needsYou.slice(0, 2).map((match) => (
              <li key={match.id}>
                <MatchCard match={match} viewerId={viewer.id} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Your rating" id="rating">
        <Panel className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
          <StatTile
            label="Overall"
            value={me ? formatRating(me.rating) : "Unrated"}
            detail={
              me
                ? `${me.tied ? "Tied " : ""}${ordinal(me.rank)} of ${overall.rated.length}`
                : "Your first confirmed match sets it."
            }
          />
          <StatTile
            label="Last match"
            value={
              me?.lastDelta != null ? (
                <RatingDelta value={me.lastDelta} />
              ) : (
                "None"
              )
            }
            detail={me ? `${me.wins}-${me.losses} record` : null}
          />
          <StatTile
            label={group.name}
            value={groupMe ? formatRating(groupMe.rating) : "Unrated"}
            detail={
              groupMe
                ? `${groupMe.tied ? "Tied " : ""}${ordinal(groupMe.rank)} of ${groupStandings.rated.length}`
                : "No confirmed match in this group yet."
            }
          />
        </Panel>
      </Section>

      {recent.matches.length > 0 ? (
        <Section
          title="Recent results"
          id="recent"
          action={
            <Link
              href={`/matches?player=${viewer.id}`}
              className="text-sm font-semibold underline"
            >
              All results
            </Link>
          }
        >
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {recent.matches.map((match) => (
              <li key={match.id}>
                <MatchCard match={match} viewerId={viewer.id} />
              </li>
            ))}
          </ul>
        </Section>
      ) : open.awaitingOpponent.length === 0 ? (
        <EmptyState
          icon={TennisBallIcon}
          title="Log your first match"
          action={<ButtonLink href="/matches/new">Log a match</ButtonLink>}
        >
          Played recently? Enter the score and your opponent confirms it. Your
          rating starts moving from there.
        </EmptyState>
      ) : null}

      {open.awaitingOpponent.length > 0 ? (
        <p className="text-muted">
          <Link
            href="/matches#awaiting"
            className="text-ink-strong font-semibold underline"
          >
            {open.awaitingOpponent.length === 1
              ? "1 match"
              : `${open.awaitingOpponent.length} matches`}
          </Link>{" "}
          waiting for your opponent to confirm.
        </p>
      ) : null}

      <Section
        title="Group standings"
        id="group"
        action={
          <Link
            href={`/groups/${group.id}`}
            className="text-sm font-semibold underline"
          >
            Open {group.name}
          </Link>
        }
      >
        {groups.length > 1 ? (
          <TabNav
            label="Choose a group"
            current={group.id}
            tabs={groups.map((g) => ({
              key: g.id,
              label: g.name,
              href: `/dashboard?group=${g.id}#group`,
            }))}
          />
        ) : null}
        {groupStandings.rated.length > 0 ? (
          <StandingsTable
            standings={groupStandings.rated.slice(0, 5)}
            viewerId={viewer.id}
            caption={`${group.name} standings, top ${Math.min(groupStandings.rated.length, 5)}`}
          />
        ) : (
          <p className="text-muted">
            No confirmed matches in {group.name} yet. The table fills in as
            results are confirmed.
          </p>
        )}
      </Section>

      {pulse.length > 0 || openForEntry.length > 0 ? (
        <Section
          title="Tournaments"
          id="tournaments"
          action={
            <Link
              href="/tournaments"
              className="text-sm font-semibold underline"
            >
              All tournaments
            </Link>
          }
        >
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pulse.map(({ detail, next }) => {
              const round = tieRoundName(next.tie.round, detail.rounds);
              const status = {
                play: `Play ${next.opponent?.name} and log the result`,
                respond: `Confirm or reject the result ${next.opponent?.name} logged`,
                fix: `Correct the result ${next.opponent?.name} rejected`,
                waiting: `Waiting for ${next.opponent?.name} to confirm`,
                await: "Your next opponent is still being decided",
              }[next.state];
              return (
                <li key={detail.id}>
                  <Link
                    href={`/tournaments/${detail.id}`}
                    className={`bg-surface hover:border-line-strong flex flex-col gap-1 border p-4 ${
                      ["play", "respond", "fix"].includes(next.state)
                        ? "border-accent border-l-4"
                        : "border-line"
                    }`}
                  >
                    <span className="type-label text-muted">{round}</span>
                    <span className="type-section">{detail.name}</span>
                    <span className="text-ink">{status}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {openForEntry.length > 0 ? (
            <p className="text-muted">
              <Link
                href="/tournaments#open"
                className="text-ink-strong font-semibold underline"
              >
                {openForEntry.length === 1
                  ? `${openForEntry[0].name} is open for entry`
                  : `${openForEntry.length} tournaments are open for entry`}
              </Link>
              .
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* Thumb-reach entry point on phones, clear of the bottom navigation. */}
      <ButtonLink
        href="/matches/new"
        aria-label="Log a match"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 size-14 px-0! shadow-(--shadow-overlay) lg:hidden"
      >
        <PlusIcon aria-hidden weight="bold" className="size-6" />
      </ButtonLink>
    </>
  );
}
