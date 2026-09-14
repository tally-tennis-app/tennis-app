import { AppPage } from "@/app/_components/app-nav";
import { MatchList, Pagination } from "./_components/match-list";
import { listMatches, pageNumber } from "@/src/lib/matches/queries";
export const metadata = { title: "Matches" };
export default async function MatchesPage({
  searchParams,
}: PageProps<"/matches">) {
  const search = await searchParams,
    page = pageNumber(search.page),
    pending = search.pending === "1",
    { matches, total } = await listMatches({ page, pending });
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">Your matches</h1>
      <p>
        Results from your active groups. Only confirmed, nonvoid matches count.
      </p>
      <MatchList matches={matches} />
      <Pagination
        page={page}
        total={total}
        path={pending ? "/matches?pending=1" : "/matches"}
      />
    </AppPage>
  );
}
