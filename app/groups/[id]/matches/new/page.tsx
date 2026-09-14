import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/app/_components/app-nav";
import { getGroup } from "@/src/lib/groups/queries";
import { MatchForm } from "@/app/matches/_components/match-form";
export default async function NewMatch({
  params,
}: PageProps<"/groups/[id]/matches/new">) {
  const { id } = await params,
    group = await getGroup(id);
  if (!group) notFound();
  const players = group.members.filter((p) => !p.leftAt);
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">Submit a match · {group.name}</h1>
      {players.length < 2 ? (
        <p>
          Invite another player before submitting a match.{" "}
          <Link className="underline" href={`/groups/${id}`}>
            Manage group
          </Link>
        </p>
      ) : (
        <MatchForm groupId={id} viewerId={group.viewerId} players={players} />
      )}
    </AppPage>
  );
}
