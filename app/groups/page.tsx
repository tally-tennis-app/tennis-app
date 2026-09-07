import Link from "next/link";

import { CreateGroupForm, JoinGroupForm } from "@/app/groups/_components/forms";
import { listMyGroups } from "@/src/lib/groups/queries";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const groups = await listMyGroups();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-5 py-12">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Your groups</h1>
        {groups.length === 0 ? (
          <p className="text-[var(--muted)]">
            You are not in a group yet. Create one, or join with an invite code
            from an organizer.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex items-center justify-between rounded border border-[var(--line)] px-4 py-3 hover:bg-[var(--paper)]"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-sm text-[var(--muted)]">
                    {group.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Create a group</h2>
        <CreateGroupForm />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Join a group</h2>
        <JoinGroupForm />
      </section>
    </main>
  );
}
