"use client";

import { WifiSlashIcon } from "@phosphor-icons/react/ssr";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Tenny is online-first (ADR 0001): nothing is cached or queued, so the honest
 * offline state is to say so and let the player retry once they reconnect.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;

  return (
    <div
      role="status"
      className="bg-brand-navy flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold text-white"
    >
      <WifiSlashIcon aria-hidden weight="bold" className="size-4 shrink-0" />
      You are offline. Tenny needs a connection to load or save anything.
    </div>
  );
}
