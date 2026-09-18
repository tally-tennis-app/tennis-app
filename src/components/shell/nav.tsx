"use client";

import {
  HouseIcon,
  ListNumbersIcon,
  TennisBallIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Tournaments joins here once Segment 9 ships; a nav item for a feature that
// does not exist yet would be a dead control. Keep this at five or fewer.
export const destinations: { href: string; label: string; icon: Icon }[] = [
  { href: "/dashboard", label: "Home", icon: HouseIcon },
  { href: "/matches", label: "Matches", icon: TennisBallIcon },
  { href: "/standings", label: "Standings", icon: ListNumbersIcon },
  { href: "/groups", label: "Groups", icon: UsersThreeIcon },
];

export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The current destination is marked three ways: aria-current for assistive
 * technology, the filled icon, and the accent bar. Never colour alone.
 */
export function RailNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {destinations.map(({ href, label, icon: NavIcon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 border-l-4 px-4 font-semibold ${
              current
                ? "border-accent bg-surface-sunken text-ink-strong"
                : "text-muted hover:text-ink-strong hover:bg-surface-sunken border-transparent"
            }`}
          >
            <NavIcon
              aria-hidden
              weight={current ? "fill" : "bold"}
              className="size-5"
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {destinations.map(({ href, label, icon: NavIcon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs font-semibold ${
                  current
                    ? "border-accent text-ink-strong"
                    : "text-muted border-transparent"
                }`}
              >
                <NavIcon
                  aria-hidden
                  weight={current ? "fill" : "bold"}
                  className="size-6"
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
