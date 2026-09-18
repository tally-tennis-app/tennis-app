import { PlusIcon, TennisBallIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { MatchCard } from "@/src/components/matches/match-card";
import { Button, ButtonLink } from "@/src/components/ui/button";
import { Alert, EmptyState } from "@/src/components/ui/feedback";
import { inputClass } from "@/src/components/ui/field";
import { PageHeader, Section } from "@/src/components/ui/structure";
import { asUuid } from "@/src/lib/forms";
import { listMyGroupsWithRoster } from "@/src/lib/groups/queries";
import {
  HISTORY_STATUSES,
  listMatches,
  listOpenMatches,
  type HistoryStatus,
} from "@/src/lib/matches/queries";
import { getViewer } from "@/src/lib/profiles/queries";

export const metadata = { title: "Matches" };

const PAGE_SIZE = 20;

const statusLabels: Record<HistoryStatus, string> = {
  confirmed: "Confirmed",
  pending: "Awaiting confirmation",
  rejected: "Rejected",
  expired: "Expired",
  voided: "Voided",
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MatchesPage({
  searchParams,
}: PageProps<"/matches">) {
  const params = await searchParams;
  const status = HISTORY_STATUSES.find((s) => s === one(params.status));
  const groupId = asUuid(one(params.group));
  const playerId = asUuid(one(params.player));
  const pages = Math.min(Math.max(Number(one(params.pages)) || 1, 1), 50);
  const filtered = Boolean(status || groupId || playerId);

  const viewer = await getViewer();
  const [open, history, groups] = await Promise.all([
    listOpenMatches(viewer.id),
    listMatches({ status, groupId, playerId }, { limit: PAGE_SIZE * pages }),
    listMyGroupsWithRoster(),
  ]);

  const people = [
    ...new Map(
      groups.flatMap((g) => g.members).map((person) => [person.id, person]),
    ).values(),
  ]
    .filter((person) => person.id !== viewer.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const moreParams = new URLSearchParams();
  if (status) moreParams.set("status", status);
  if (groupId) moreParams.set("group", groupId);
  if (playerId) moreParams.set("player", playerId);
  moreParams.set("pages", String(pages + 1));

  // Unfiltered history leaves out what the sections above already show.
  const openIds = new Set(
    [...open.needsYou, ...open.awaitingOpponent].map((match) => match.id),
  );
  const historyMatches = filtered
    ? history.matches
    : history.matches.filter((match) => !openIds.has(match.id));

  const nothingYet =
    !filtered &&
    history.matches.length === 0 &&
    open.needsYou.length === 0 &&
    open.awaitingOpponent.length === 0;

  return (
    <>
      <PageHeader
        title="Matches"
        actions={
          <ButtonLink href="/matches/new">
            <PlusIcon aria-hidden weight="bold" className="size-5" />
            Log a match
          </ButtonLink>
        }
      />

      {one(params.withdrawn) ? (
        <Alert tone="positive">The match was withdrawn.</Alert>
      ) : null}

      {nothingYet ? (
        <EmptyState
          icon={TennisBallIcon}
          title="No matches yet"
          action={<ButtonLink href="/matches/new">Log a match</ButtonLink>}
        >
          Log your first result. Your opponent confirms it, then it counts
          toward your group&apos;s standings.
        </EmptyState>
      ) : null}

      {open.needsYou.length > 0 ? (
        <Section title="Needs you" id="needs-you">
          <ul className="grid gap-3 lg:grid-cols-2">
            {open.needsYou.map((match) => (
              <li key={match.id}>
                <MatchCard match={match} viewerId={viewer.id} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {open.awaitingOpponent.length > 0 ? (
        <Section title="Waiting on your opponent" id="awaiting">
          <ul className="grid gap-3 lg:grid-cols-2">
            {open.awaitingOpponent.map((match) => (
              <li key={match.id}>
                <MatchCard match={match} viewerId={viewer.id} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {!nothingYet ? (
        <Section title="History" id="history">
          <form
            method="get"
            aria-label="Filter matches"
            className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end"
          >
            <FilterSelect label="Status" name="status" value={status}>
              {HISTORY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Group" name="group" value={groupId}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Player" name="player" value={playerId}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FilterSelect>
            <div className="flex gap-3">
              <Button type="submit" variant="secondary">
                Apply
              </Button>
              {filtered ? (
                <ButtonLink href="/matches" variant="quiet">
                  Reset
                </ButtonLink>
              ) : null}
            </div>
          </form>

          {historyMatches.length === 0 ? (
            filtered ? (
              <p className="text-muted">
                No matches fit these filters.{" "}
                <Link href="/matches" className="text-ink-strong underline">
                  Show all matches
                </Link>
              </p>
            ) : (
              <p className="text-muted">Confirmed results will collect here.</p>
            )
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {historyMatches.map((match) => (
                <li key={match.id}>
                  <MatchCard match={match} viewerId={viewer.id} />
                </li>
              ))}
            </ul>
          )}

          {history.hasMore ? (
            <ButtonLink
              href={`/matches?${moreParams}#history`}
              variant="secondary"
              scroll={false}
              className="self-start"
            >
              Show more matches
            </ButtonLink>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={`filter-${name}`}
        className="text-ink-strong text-sm font-semibold"
      >
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className={inputClass}
      >
        <option value="">All</option>
        {children}
      </select>
    </div>
  );
}
