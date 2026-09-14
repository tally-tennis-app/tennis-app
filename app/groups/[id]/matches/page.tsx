import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/app/_components/app-nav";
import { getGroup } from "@/src/lib/groups/queries";
import { listMatches, pageNumber } from "@/src/lib/matches/queries";
import { MatchList, Pagination } from "@/app/matches/_components/match-list";
export default async function GroupMatches({
  params,
  searchParams,
}: PageProps<"/groups/[id]/matches">) {
  const { id } = await params,
    group = await getGroup(id);
  if (!group) notFound();
  const page = pageNumber((await searchParams).page),
    { matches, total } = await listMatches({ groupId: id, page });
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">{group.name} matches</h1>
      <div className="flex gap-5">
        <Link className="underline" href={`/groups/${id}/matches/new`}>
          Submit a match
        </Link>
        <Link className="underline" href={`/groups/${id}/standings`}>
          Group standings
        </Link>
      </div>
      <MatchList matches={matches} />
      <Pagination page={page} total={total} path={`/groups/${id}/matches`} />
    </AppPage>
  );
}
