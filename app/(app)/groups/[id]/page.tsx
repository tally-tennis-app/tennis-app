import {
  GearSixIcon,
  PlusIcon,
  TennisBallIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InviteCodeActions } from "@/src/components/groups/group-dialogs";
import { MatchCard } from "@/src/components/matches/match-card";
import { StandingsTable } from "@/src/components/ratings/standings-table";
import { ButtonLink } from "@/src/components/ui/button";
import { Alert, EmptyState } from "@/src/components/ui/feedback";
import {
  Avatar,
  PageHeader,
  Panel,
  RoleBadge,
  Section,
  TabNav,
} from "@/src/components/ui/structure";
import { formatDate } from "@/src/lib/format";
import { getGroup, type GroupDetail } from "@/src/lib/groups/queries";
import { listMatches } from "@/src/lib/matches/queries";
import { getStandings } from "@/src/lib/ratings/queries";

const TABS = ["overview", "standings", "matches", "members"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const group = await getGroup(id);
  return { title: group?.name ?? "Group" };
}

export default async function GroupPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const tab: Tab = TABS.find((t) => t === query.tab) ?? "overview";
  const group = await getGroup(id);

  // Null covers both "no such group" and "not yours". RLS makes them
  // indistinguishable, which is what stops a stranger probing group ids.
  if (!group) notFound();

  const active = group.members.filter((member) => !member.leftAt);
  const viewerRole =
    active.find((m) => m.userId === group.viewerId)?.role ?? "player";

  return (
    <>
      <PageHeader
        title={group.name}
        back={{ href: "/groups", label: "Groups" }}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <RoleBadge role={viewerRole} />
            <span>
              {active.length} {active.length === 1 ? "member" : "members"}
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/matches/new?group=${group.id}`}>
              <PlusIcon aria-hidden weight="bold" className="size-5" />
              Log a match
            </ButtonLink>
            <ButtonLink
              href={`/groups/${group.id}/settings`}
              variant="secondary"
            >
              <GearSixIcon aria-hidden weight="bold" className="size-5" />
              {group.viewerIsOrganizer ? "Manage" : "Settings"}
            </ButtonLink>
          </>
        }
      />

      {query.created ? (
        <Alert tone="positive" title="Group created">
          Share the invite code below so your players can join.
        </Alert>
      ) : null}
      {query.joined ? (
        <Alert tone="positive">Welcome to {group.name}.</Alert>
      ) : null}
      {query.transferred ? (
        <Alert tone="positive">The organizer role was handed over.</Alert>
      ) : null}

      <TabNav
        label="Group sections"
        current={tab}
        tabs={TABS.map((t) => ({
          key: t,
          label: t[0].toUpperCase() + t.slice(1),
          href:
            t === "overview"
              ? `/groups/${group.id}`
              : `/groups/${group.id}?tab=${t}`,
        }))}
      />

      {tab === "overview" ? <Overview group={group} /> : null}
      {tab === "standings" ? <GroupStandings group={group} /> : null}
      {tab === "matches" ? <GroupMatches group={group} /> : null}
      {tab === "members" ? <Members group={group} /> : null}
    </>
  );
}

function InvitePanel({ group }: { group: GroupDetail }) {
  const expired = group.inviteExpired;
  return (
    <Panel className="flex flex-col gap-3 self-start p-5">
      <h2 className="type-section">Invite players</h2>
      <p className="type-code text-ink-strong text-2xl">{group.inviteCode}</p>
      <p className="text-muted text-sm">
        {expired
          ? "This code has expired. An organizer can create a new one."
          : `Valid until ${formatDate(group.inviteExpiresAt)}. Anyone with the code can join.`}
      </p>
      {!expired ? (
        <InviteCodeActions code={group.inviteCode} groupName={group.name} />
      ) : null}
    </Panel>
  );
}

async function Overview({ group }: { group: GroupDetail }) {
  const [{ rated }, { matches }] = await Promise.all([
    getStandings(group.id),
    listMatches({ groupId: group.id }, { limit: 3 }),
  ]);
  const onlyMember = group.members.filter((m) => !m.leftAt).length === 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-8">
        <Section
          title="Standings"
          action={
            rated.length > 0 ? (
              <Link
                href={`/groups/${group.id}?tab=standings`}
                className="text-sm font-semibold underline"
              >
                Full table
              </Link>
            ) : null
          }
        >
          {rated.length > 0 ? (
            <StandingsTable
              standings={rated.slice(0, 5)}
              viewerId={group.viewerId}
              caption={`${group.name} standings, top ${Math.min(rated.length, 5)}`}
            />
          ) : (
            <p className="text-muted">
              Standings appear after the first confirmed match. Everyone starts
              at 1500.
            </p>
          )}
        </Section>
        <Section
          title="Recent matches"
          action={
            matches.length > 0 ? (
              <Link
                href={`/groups/${group.id}?tab=matches`}
                className="text-sm font-semibold underline"
              >
                All matches
              </Link>
            ) : null
          }
        >
          {matches.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {matches.map((match) => (
                <li key={match.id}>
                  <MatchCard match={match} viewerId={group.viewerId} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={TennisBallIcon}
              title={onlyMember ? "Invite someone to play" : "No matches yet"}
              action={
                onlyMember ? null : (
                  <ButtonLink href={`/matches/new?group=${group.id}`}>
                    Log a match
                  </ButtonLink>
                )
              }
            >
              {onlyMember
                ? "You are the only member so far. Share the invite code, then log your first match."
                : "Log the first result in this group."}
            </EmptyState>
          )}
        </Section>
      </div>
      <InvitePanel group={group} />
    </div>
  );
}

async function GroupStandings({ group }: { group: GroupDetail }) {
  const { rated, unrated } = await getStandings(group.id);
  return (
    <div className="flex flex-col gap-6">
      {rated.length > 0 ? (
        <StandingsTable
          standings={rated}
          viewerId={group.viewerId}
          caption={`${group.name} standings`}
        />
      ) : (
        <p className="text-muted">No confirmed matches in this group yet.</p>
      )}
      {unrated.length > 0 ? (
        <p className="text-muted text-sm">
          Not rated yet: {unrated.map((row) => row.name).join(", ")}.
        </p>
      ) : null}
      <p className="text-muted text-sm">
        Group ratings count only matches played in this group. Former members
        keep their place, marked as such.{" "}
        <Link
          href={`/standings?group=${group.id}`}
          className="text-ink-strong underline"
        >
          How ratings work
        </Link>
      </p>
    </div>
  );
}

async function GroupMatches({ group }: { group: GroupDetail }) {
  const { matches, hasMore } = await listMatches(
    { groupId: group.id },
    { limit: 20 },
  );
  if (matches.length === 0) {
    return <p className="text-muted">No matches in this group yet.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 lg:grid-cols-2">
        {matches.map((match) => (
          <li key={match.id}>
            <MatchCard match={match} viewerId={group.viewerId} />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <ButtonLink
          href={`/matches?group=${group.id}`}
          variant="secondary"
          className="self-start"
        >
          See all in Matches
        </ButtonLink>
      ) : null}
    </div>
  );
}

function Members({ group }: { group: GroupDetail }) {
  const active = group.members.filter((m) => !m.leftAt);
  const departed = group.members.filter((m) => m.leftAt);

  return (
    <div className="flex flex-col gap-8">
      <ul className="border-line bg-surface divide-line divide-y border">
        {active.map((member) => (
          <li key={member.userId}>
            <Link
              href={`/players/${member.userId}`}
              className="hover:bg-surface-sunken flex min-h-14 items-center gap-3 px-4 py-2"
            >
              <Avatar name={member.displayName} size="sm" />
              <span className="text-ink-strong min-w-0 flex-1 truncate font-semibold">
                {member.displayName}
                {member.userId === group.viewerId ? " (you)" : ""}
              </span>
              <RoleBadge role={member.role} />
            </Link>
          </li>
        ))}
      </ul>
      {departed.length > 0 ? (
        <Section title="Former members">
          <p className="text-muted text-sm">
            Their results stay in the group&apos;s history and standings.
          </p>
          <ul className="flex flex-wrap gap-2">
            {departed.map((member) => (
              <li
                key={member.userId}
                className="border-line text-muted inline-flex min-h-11 items-center gap-2 border px-3"
              >
                {member.displayName}
                <span className="text-xs">
                  {member.wasRemoved ? "Removed" : "Left"}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
