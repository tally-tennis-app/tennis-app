import {
  ListNumbersIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { StandingsTable } from "@/src/components/ratings/standings-table";
import { Button, ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";
import { inputClass } from "@/src/components/ui/field";
import { PageHeader, Section, TabNav } from "@/src/components/ui/structure";
import { asUuid } from "@/src/lib/forms";
import { listMyGroups } from "@/src/lib/groups/queries";
import { getViewer } from "@/src/lib/profiles/queries";
import { getStandings } from "@/src/lib/ratings/queries";

export const metadata = { title: "Standings" };

// Below this a search box is clutter; the whole table fits on a screen.
const SEARCH_THRESHOLD = 12;

export default async function StandingsPage({
  searchParams,
}: PageProps<"/standings">) {
  const params = await searchParams;
  const viewer = await getViewer();
  const groups = await listMyGroups();
  const requested = asUuid(
    typeof params.group === "string" ? params.group : undefined,
  );
  const group = groups.find((g) => g.id === requested);
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const { rated, unrated } = await getStandings(group?.id);

  const total = rated.length + unrated.length;
  const match = (name: string) =>
    name.toLowerCase().includes(query.toLowerCase());
  const shownRated = query ? rated.filter((row) => match(row.name)) : rated;
  const shownUnrated = query
    ? unrated.filter((row) => match(row.name))
    : unrated;
  const scopeLabel = group ? group.name : "Overall";

  return (
    <>
      <PageHeader
        title="Standings"
        description={
          group
            ? `Ratings from matches played in ${group.name}.`
            : "Overall ratings, from every match each player has confirmed, for everyone in your groups."
        }
      />

      {groups.length > 0 ? (
        <TabNav
          label="Standings scope"
          current={group?.id ?? "overall"}
          tabs={[
            { key: "overall", label: "Overall", href: "/standings" },
            ...groups.map((g) => ({
              key: g.id,
              label: g.name,
              href: `/standings?group=${g.id}`,
            })),
          ]}
        />
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={ListNumbersIcon}
          title="No standings yet"
          action={<ButtonLink href="/groups">Go to groups</ButtonLink>}
        >
          Standings come from matches within your groups. Join or create one to
          get started.
        </EmptyState>
      ) : (
        <>
          {total > SEARCH_THRESHOLD ? (
            <form
              method="get"
              role="search"
              className="flex max-w-md items-end gap-3"
            >
              {group ? (
                <input type="hidden" name="group" value={group.id} />
              ) : null}
              <div className="flex flex-1 flex-col gap-2">
                <label
                  htmlFor="q"
                  className="text-ink-strong text-sm font-semibold"
                >
                  Find a player
                </label>
                <input
                  id="q"
                  name="q"
                  defaultValue={query}
                  className={inputClass}
                />
              </div>
              <Button type="submit" variant="secondary" aria-label="Search">
                <MagnifyingGlassIcon
                  aria-hidden
                  weight="bold"
                  className="size-5"
                />
              </Button>
            </form>
          ) : null}

          {rated.length === 0 ? (
            <EmptyState
              icon={ListNumbersIcon}
              title="No rated matches yet"
              action={<ButtonLink href="/matches/new">Log a match</ButtonLink>}
            >
              Standings appear once a match is confirmed. Everyone starts at
              1500.
            </EmptyState>
          ) : shownRated.length > 0 ? (
            <StandingsTable
              standings={shownRated}
              viewerId={viewer.id}
              caption={`${scopeLabel} standings`}
            />
          ) : (
            <p className="text-muted">
              No rated player matches “{query}”.{" "}
              <Link
                href={group ? `/standings?group=${group.id}` : "/standings"}
                className="text-ink-strong underline"
              >
                Clear search
              </Link>
            </p>
          )}

          {shownUnrated.length > 0 ? (
            <Section title="Not rated yet" id="unrated">
              <p className="text-muted">
                These players have no confirmed
                {group ? " match in this group" : " match"} yet. Their first
                result places them.
              </p>
              <ul className="flex flex-wrap gap-2">
                {shownUnrated.map((row) => (
                  <li key={row.playerId}>
                    <Link
                      href={`/players/${row.playerId}`}
                      className="border-line bg-surface hover:border-line-strong inline-flex min-h-11 items-center border px-3 font-semibold"
                    >
                      {row.name}
                      {row.playerId === viewer.id ? " (you)" : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <details className="border-line bg-surface border px-5 py-4">
            <summary className="text-ink-strong min-h-11 cursor-pointer content-center font-semibold">
              How ratings work
            </summary>
            <ul className="mt-3 flex max-w-prose list-disc flex-col gap-2 pl-5">
              <li>
                Everyone starts at 1500. Beating a higher-rated player moves you
                further.
              </li>
              <li>
                The margin counts a little: a 6-0 6-0 win is worth up to a
                quarter more than a tiebreak grind.
              </li>
              <li>
                Ratings update in the order matches are confirmed, not the date
                they were played. Logging an older match never rewrites later
                results.
              </li>
              <li>
                Walkovers are not rated. A retirement counts on the games
                played.
              </li>
              <li>
                A voided match drops out, and every rating after it
                recalculates.
              </li>
              <li>
                Players on the same displayed rating share a rank, shown as T
                for tied.
              </li>
            </ul>
          </details>
        </>
      )}
    </>
  );
}
