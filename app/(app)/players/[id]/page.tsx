import { notFound, redirect } from "next/navigation";

import { PlayerProfileView } from "@/src/components/players/player-profile";
import { getPlayer } from "@/src/lib/profiles/players";
import { getViewer } from "@/src/lib/profiles/queries";

export async function generateMetadata({ params }: PageProps<"/players/[id]">) {
  const { id } = await params;
  const player = await getPlayer(id);
  return { title: player?.name ?? "Player" };
}

export default async function PlayerPage({
  params,
}: PageProps<"/players/[id]">) {
  const { id } = await params;
  const [player, viewer] = await Promise.all([getPlayer(id), getViewer()]);

  if (!player) notFound();
  if (player.id === viewer.id) redirect("/profile");

  return <PlayerProfileView player={player} viewerId={viewer.id} />;
}
