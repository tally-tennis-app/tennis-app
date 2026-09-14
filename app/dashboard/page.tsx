import Link from "next/link";
import { AppPage } from "@/app/_components/app-nav";
import { listMyGroups } from "@/src/lib/groups/queries";
import { listMatches } from "@/src/lib/matches/queries";
import { MatchList } from "@/app/matches/_components/match-list";
export const metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const [groups, { matches, total }] = await Promise.all([
    listMyGroups(),
    listMatches({ pending: true }),
  ]);
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">Your tennis</h1>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Your groups</h2>
        {groups.length ? (
          <ul>
            {groups.map((g) => (
              <li className="py-2" key={g.id}>
                <Link className="underline" href={`/groups/${g.id}`}>
                  {g.name}
                </Link>{" "}
                ·{" "}
                <Link
                  className="underline"
                  href={`/groups/${g.id}/matches/new`}
                >
                  Submit a match
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Join or create a group to get started.</p>
        )}
        <Link className="underline" href="/groups">
          Manage groups
        </Link>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">
          Awaiting your confirmation ({total})
        </h2>
        {matches.length ? (
          <MatchList matches={matches} />
        ) : (
          <p>You have no results waiting for confirmation.</p>
        )}
        {total > 25 && (
          <Link className="underline" href="/matches?pending=1">
            All pending confirmations
          </Link>
        )}
      </section>
    </AppPage>
  );
}
