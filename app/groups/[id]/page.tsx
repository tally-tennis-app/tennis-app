import Link from "next/link";
import { notFound } from "next/navigation";

import {
  leaveGroup,
  removeMember,
  rotateInvite,
  setMemberRole,
} from "@/app/groups/actions";
import { getGroup } from "@/src/lib/groups/queries";

export default async function GroupPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const group = await getGroup(id);

  // Null covers both "no such group" and "not yours" -- RLS makes them
  // indistinguishable, which is what stops a stranger probing group ids.
  if (!group) notFound();

  const active = group.members.filter((member) => !member.leftAt);
  const departed = group.members.filter((member) => member.leftAt);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/groups" className="text-sm text-[var(--muted)] underline">
          All groups
        </Link>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
      </div>

      {typeof error === "string" ? (
        <p role="alert" className="text-sm text-[var(--clay)]">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2 rounded border border-[var(--line)] p-4">
        <h2 className="text-lg font-semibold">Invite code</h2>
        <p className="font-mono text-xl tracking-widest">{group.inviteCode}</p>
        <p className="text-sm text-[var(--muted)]">
          Expires {new Date(group.inviteExpiresAt).toLocaleDateString()}. Any
          member can share this code; an organizer can rotate it to revoke it.
        </p>
        {group.viewerIsOrganizer ? (
          <form action={rotateInvite}>
            <input type="hidden" name="groupId" value={group.id} />
            <button
              type="submit"
              className="rounded border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Rotate code
            </button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="flex flex-col gap-2">
          {active.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--line)] px-4 py-3"
            >
              <span>
                <span className="font-medium">{member.displayName}</span>{" "}
                <span className="text-sm text-[var(--muted)]">
                  {member.role}
                </span>
              </span>
              {group.viewerIsOrganizer && member.userId !== group.viewerId ? (
                <span className="flex gap-2">
                  <form action={setMemberRole}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <input
                      type="hidden"
                      name="role"
                      value={
                        member.role === "organizer" ? "player" : "organizer"
                      }
                    />
                    <button
                      type="submit"
                      className="rounded border border-[var(--line)] px-3 py-1.5 text-sm"
                    >
                      {member.role === "organizer" ? "Demote" : "Promote"}
                    </button>
                  </form>
                  <form action={removeMember}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <button
                      type="submit"
                      className="rounded border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--clay)]"
                    >
                      Remove
                    </button>
                  </form>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {departed.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Former members</h2>
          <p className="text-sm text-[var(--muted)]">
            Their results stay in the group history.
          </p>
          <ul className="flex flex-col gap-1 text-[var(--muted)]">
            {departed.map((member) => (
              <li key={member.userId}>{member.displayName}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action={leaveGroup}>
        <input type="hidden" name="groupId" value={group.id} />
        <button
          type="submit"
          className="rounded border border-[var(--line)] px-4 py-2 text-sm font-medium"
        >
          Leave this group
        </button>
      </form>
    </main>
  );
}
