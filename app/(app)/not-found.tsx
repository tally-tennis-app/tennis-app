import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";

import { ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";

// "Not found" and "not yours" look the same on purpose: RLS hides both.
export default function AppNotFound() {
  return (
    <EmptyState
      icon={MagnifyingGlassIcon}
      title="Nothing here"
      action={<ButtonLink href="/dashboard">Go to Home</ButtonLink>}
    >
      This page does not exist, or it belongs to a group you are not in.
    </EmptyState>
  );
}
