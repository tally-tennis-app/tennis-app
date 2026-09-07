import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { requireUser } from "@/src/lib/auth/dal";

export const metadata = { title: "Dashboard" };

// ponytail: placeholder. Milestone D replaces this with the real application
// shell (groups, matches, standings, profile).
export default async function DashboardPage() {
  // Not redundant with proxy.ts. Next does not guarantee proxy coverage for
  // Server Functions, so the session is verified again at the data source.
  const user = await requireUser("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-16">
      <h1 className="text-2xl font-semibold">Signed in</h1>
      <p className="text-[var(--muted)]">
        You are signed in as {user.email}. Matches and standings arrive in the
        next milestones.
      </p>
      <Link href="/groups" className="underline">
        Your groups
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded border border-[var(--line)] px-4 py-2 font-medium"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
