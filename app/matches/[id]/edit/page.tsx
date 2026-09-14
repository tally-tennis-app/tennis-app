import { notFound, redirect } from "next/navigation";
import { AppPage } from "@/app/_components/app-nav";
import { getMatch } from "@/src/lib/matches/queries";
import { getGroup } from "@/src/lib/groups/queries";
import { matchStatus } from "@/src/lib/matches/input";
import { MatchForm } from "@/app/matches/_components/match-form";
export default async function EditMatch({
  params,
}: PageProps<"/matches/[id]/edit">) {
  const { id } = await params,
    match = await getMatch(id);
  if (!match) notFound();
  const group = await getGroup(match.group_id);
  if (!group) notFound();
  if (group.viewerId !== match.submitted_by || matchStatus(match) !== "pending")
    redirect(`/matches/${id}`);
  return (
    <AppPage>
      <h1 className="text-2xl font-semibold">Edit pending match</h1>
      <MatchForm
        groupId={group.id}
        viewerId={group.viewerId}
        players={group.members.filter((p) => !p.leftAt)}
        match={match}
      />
    </AppPage>
  );
}
