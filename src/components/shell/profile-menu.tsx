import {
  GearSixIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { Avatar } from "@/src/components/ui/structure";
import type { Viewer } from "@/src/lib/profiles/queries";

const item =
  "flex min-h-11 w-full items-center gap-3 px-4 text-left font-semibold text-ink-strong hover:bg-surface-sunken";

/**
 * A native popover: light dismiss, Escape, and top-layer stacking come from
 * the browser, and it works before any JavaScript loads.
 */
export function ProfileMenu({ viewer }: { viewer: Viewer }) {
  return (
    <>
      <button
        type="button"
        popoverTarget="profile-menu"
        aria-label={`Account menu for ${viewer.displayName}`}
        className="grid size-11 place-items-center"
      >
        <Avatar name={viewer.displayName} size="sm" />
      </button>
      <div
        id="profile-menu"
        popover="auto"
        className="border-line bg-surface text-ink fixed inset-auto top-[calc(env(safe-area-inset-top)+3.75rem)] right-4 m-0 w-64 border p-0 shadow-(--shadow-overlay)"
      >
        <div className="border-line border-b px-4 py-3">
          <p className="text-ink-strong truncate font-bold">
            {viewer.displayName}
          </p>
          <p className="text-muted truncate text-sm">{viewer.email}</p>
        </div>
        <ul className="py-1">
          <li>
            <Link href="/profile" className={item}>
              <UserCircleIcon aria-hidden weight="bold" className="size-5" />
              Your profile
            </Link>
          </li>
          <li>
            <Link href="/settings" className={item}>
              <GearSixIcon aria-hidden weight="bold" className="size-5" />
              Settings
            </Link>
          </li>
          <li className="border-line border-t">
            <form action={signOut}>
              <button type="submit" className={item}>
                <SignOutIcon aria-hidden weight="bold" className="size-5" />
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </div>
    </>
  );
}
