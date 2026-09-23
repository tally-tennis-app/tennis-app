import { PencilSimpleIcon } from "@phosphor-icons/react/ssr";

import { PlayerProfileView } from "@/src/components/players/player-profile";
import { ButtonLink } from "@/src/components/ui/button";
import { getPlayer } from "@/src/lib/profiles/players";
import { getViewer } from "@/src/lib/profiles/queries";

export const metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const viewer = await getViewer();
  const player = await getPlayer(viewer.id);

  return (
    <PlayerProfileView
      player={
        player ?? {
          id: viewer.id,
          name: viewer.displayName,
          memberSince: new Date().toISOString(),
          hometown: viewer.hometown,
          bio: viewer.bio,
          avatarUrl: viewer.avatarUrl,
        }
      }
      viewerId={viewer.id}
      actions={
        <ButtonLink href="/settings#profile" variant="secondary">
          <PencilSimpleIcon aria-hidden weight="bold" className="size-4" />
          Edit profile
        </ButtonLink>
      }
    />
  );
}
