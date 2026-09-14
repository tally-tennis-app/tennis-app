import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/app/_components/app-nav";
import { getGroup } from "@/src/lib/groups/queries";
import { ratings, groupStandings } from "@/src/lib/matches/queries";
import { StandingsTable } from "@/app/standings/table";
export default async function GroupStandings({
  params,
}: PageProps<"/groups/[id]/standings">) {
  const { id } = await params,
    group = await getGroup(id);
  if (!group) notFound();
  const [rows, records] = await Promise.all([ratings(id), groupStandings(id)]);
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">{group.name} standings</h1>
      <Link className="underline" href={`/groups/${id}/matches`}>
        Group matches
      </Link>
      <StandingsTable rows={rows} records={records} />
    </AppPage>
  );
}
