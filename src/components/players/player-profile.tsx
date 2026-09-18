import { TennisBallIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { MatchCard, RatingDelta } from "@/src/components/matches/match-card";
import { FormStrip } from "@/src/components/ratings/standings-table";
import { ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";
import {
  Avatar,
  Panel,
  RoleBadge,
  Section,
  StatTile,
} from "@/src/components/ui/structure";
import { formatDate, formatRating } from "@/src/lib/format";
import { listMyGroupsWithRoster } from "@/src/lib/groups/queries";
import { getMatchesByIds, listMatches } from "@/src/lib/matches/queries";
import type { PlayerProfile } from "@/src/lib/profiles/players";
import { getRatingHistory, getStandings } from "@/src/lib/ratings/queries";
import { ordinal, STARTING_RATING } from "@/src/lib/ratings/types";

const HISTORY_ROWS = 10;

export async function PlayerProfileView({
  player,
  viewerId,
  actions,
}: {
  player: PlayerProfile;
  viewerId: string;
  actions?: React.ReactNode;
}) {
  const own = player.id === viewerId;
  const [overall, groups, history, recent] = await Promise.all([
    getStandings(),
    listMyGroupsWithRoster(),
    getRatingHistory(player.id),
    listMatches({ playerId: player.id }, { limit: 4 }),
  ]);

  const standing = overall.rated.find((row) => row.playerId === player.id);
  // Your own profile lists all your groups; someone else's only the ones you share.
  const sharedGroups = groups.filter((g) =>
    own ? true : g.members.some((m) => m.id === player.id),
  );
  const latest = history.slice(-HISTORY_ROWS).reverse();
  // Rating events carry no opponent, so read each match for who it was against.
  const matches = new Map(
    (await getMatchesByIds(latest.map((event) => event.matchId))).map((m) => [
      m.id,
      m,
    ]),
  );
  const result = (matchId: string) => {
    const match = matches.get(matchId);
    if (!match) return "Match";
    const opponent =
      match.submitter.id === player.id ? match.opponent : match.submitter;
    return `${match.winnerId === player.id ? "Beat" : "Lost to"} ${opponent.name}`;
  };
  const best = history.length
    ? Math.max(...history.map((event) => event.after))
    : null;

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={player.name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="type-title break-words">{player.name}</h1>
          <p className="text-muted">
            On Tenny since {formatDate(player.memberSince)}
          </p>
        </div>
        {actions}
      </header>

      <Panel className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Overall rating"
          value={standing ? formatRating(standing.rating) : "Unrated"}
          detail={
            standing
              ? `${standing.tied ? "Tied " : ""}${ordinal(standing.rank)} among ${own ? "your" : "your shared"} groups`
              : "No confirmed match yet."
          }
        />
        <StatTile
          label="Record"
          value={standing ? `${standing.wins}-${standing.losses}` : "0-0"}
          detail={standing ? `${standing.played} rated matches` : null}
        />
        <StatTile
          label="Best rating"
          value={best !== null ? formatRating(best) : "None"}
          detail={best !== null ? `Started at ${STARTING_RATING}` : null}
        />
        <div className="flex flex-col gap-2">
          <p className="type-label text-muted">Recent form</p>
          <FormStrip form={standing?.form ?? []} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section
          title="Recent matches"
          action={
            recent.matches.length > 0 ? (
              <Link
                href={`/matches?player=${player.id}`}
                className="text-sm font-semibold underline"
              >
                All matches
              </Link>
            ) : null
          }
        >
          {recent.matches.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recent.matches.map((match) => (
                <li key={match.id}>
                  <MatchCard match={match} viewerId={viewerId} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={TennisBallIcon}
              title="No matches yet"
              action={
                own ? (
                  <ButtonLink href="/matches/new">Log a match</ButtonLink>
                ) : null
              }
            >
              {own
                ? "Your results and rating history will build up here."
                : `${player.name} has no matches you can see yet.`}
            </EmptyState>
          )}
        </Section>

        <div className="flex flex-col gap-8">
          <Section title={own ? "Your groups" : "Groups you share"}>
            {sharedGroups.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {sharedGroups.map((group) => (
                  <li key={group.id}>
                    <Link
                      href={`/groups/${group.id}`}
                      className="border-line bg-surface hover:border-line-strong flex min-h-12 items-center justify-between gap-3 border px-4"
                    >
                      <span className="text-ink-strong font-semibold">
                        {group.name}
                      </span>
                      {own ? <RoleBadge role={group.role} /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                {own
                  ? "You are not in a group yet."
                  : "You no longer share a group."}
              </p>
            )}
          </Section>

          <Section title="Rating history">
            {latest.length > 0 ? (
              <div className="border-line bg-surface relative overflow-x-auto border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    {player.name}&apos;s rating after each confirmed match, most
                    recent first
                  </caption>
                  <thead className="type-label text-muted border-line border-b">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-normal">
                        Confirmed
                      </th>
                      <th scope="col" className="py-3 pr-4 font-normal">
                        Result
                      </th>
                      <th
                        scope="col"
                        className="py-3 pr-4 text-right font-normal"
                      >
                        Change
                      </th>
                      <th
                        scope="col"
                        className="py-3 pr-4 text-right font-normal"
                      >
                        Rating
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {latest.map((event) => (
                      <tr key={event.matchId}>
                        <td className="text-muted px-4 py-3 whitespace-nowrap">
                          {formatDate(event.confirmedAt)}
                        </td>
                        <td className="py-3 pr-4">
                          <Link
                            href={`/matches/${event.matchId}`}
                            className="hover:underline"
                          >
                            {result(event.matchId)}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <RatingDelta value={event.after - event.before} />
                        </td>
                        <td className="type-score py-3 pr-4 text-right">
                          {formatRating(event.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">No rated matches yet.</p>
            )}
            <p className="text-muted text-sm">
              Listed in the order matches were confirmed, which is the order
              ratings change.{" "}
              {own ? null : "Only matches in groups you share are listed."}
            </p>
          </Section>
        </div>
      </div>
    </>
  );
}
