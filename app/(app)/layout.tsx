import { PlusIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { TennyLockup, TennyMark } from "@/src/components/brand";
import { BottomNav, RailNav } from "@/src/components/shell/nav";
import { ProfileMenu } from "@/src/components/shell/profile-menu";
import { ButtonLink } from "@/src/components/ui/button";
import { OfflineBanner } from "@/src/components/ui/offline-banner";
import { getViewer } from "@/src/lib/profiles/queries";

/**
 * The one shell every signed-in route shares. getViewer() verifies the session
 * at the data source; the navigation shown here is not a security boundary.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <a
        href="#main"
        className="bg-action text-on-action sr-only z-50 px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="border-line bg-surface sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r py-6 lg:flex">
        <Link href="/dashboard" aria-label="Tenny home" className="px-5">
          <TennyLockup height={28} alt="" />
        </Link>
        <RailNav />
        <div className="px-4">
          <ButtonLink href="/matches/new" className="w-full">
            <PlusIcon aria-hidden weight="bold" className="size-5" />
            Log a match
          </ButtonLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-canvas/95 sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)] backdrop-blur lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none">
          <div className="flex h-15 items-center justify-between px-4 sm:px-8">
            <Link
              href="/dashboard"
              aria-label="Tenny home"
              className="flex min-h-11 items-center lg:invisible"
            >
              <TennyMark height={30} alt="" />
            </Link>
            <ProfileMenu viewer={viewer} />
          </div>
        </header>
        <OfflineBanner />

        <main
          id="main"
          className="max-w-content mx-auto flex w-full flex-1 flex-col gap-8 px-4 pt-4 pb-28 sm:px-8 lg:pt-2 lg:pb-16"
        >
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
