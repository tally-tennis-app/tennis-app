import { PencilSimpleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  describeMatch,
  MatchStatusBadge,
  RatingDelta,
  Scoreline,
} from "@/src/components/matches/match-card";
import {
  ConfirmMatchButton,
  RejectMatchButton,
  VoidMatchButton,
  WithdrawMatchButton,
} from "@/src/components/matches/match-actions";
import { ButtonLink } from "@/src/components/ui/button";
import { Alert } from "@/src/components/ui/feedback";
import { PageHeader, Panel, Section } from "@/src/components/ui/structure";
import { formatDate, formatPlayedOn } from "@/src/lib/format";
import { getGroupRole } from "@/src/lib/groups/queries";
import { getMatch } from "@/src/lib/matches/queries";
import { EXPIRY_DAYS, type MatchView } from "@/src/lib/matches/types";
import { getViewer } from "@/src/lib/profiles/queries";

export const metadata = { title: "Match" };

const outcomeLabels = {
  completed: "Completed",
  retired: "Retired",
  walkover: "Walkover",
} as const;

function timeline(match: MatchView) {
  const events: { label: string; at: string; detail?: string | null }[] = [
    { label: `Submitted by ${match.submitter.name}`, at: match.submittedAt },
  ];
  if (match.rejectedAt) {
    events.push({
      label: `Rejected by ${match.opponent.name}`,
      at: match.rejectedAt,
      detail: match.rejectionReason,
    });
  }
  if (match.confirmedAt) {
    events.push({
      label: `Confirmed by ${match.opponent.name}`,
      at: match.confirmedAt,
    });
  }
  if (match.status === "expired") {
    const expiry = new Date(
      new Date(match.submittedAt).getTime() + EXPIRY_DAYS * 86_400_000,
    );
    events.push({
      label: "Expired without a response",
      at: expiry.toISOString(),
    });
  }
  if (match.voidedAt) {
    events.push({
      label: "Voided by an organizer",
      at: match.voidedAt,
      detail: match.voidReason,
    });
  }
  return events;
}

export default async function MatchPage({
  params,
  searchParams,
}: PageProps<"/matches/[id]">) {
  const { id } = await params;
  const { submitted, updated } = await searchParams;
  const [match, viewer] = await Promise.all([getMatch(id), getViewer()]);

  // Null covers "no such match" and "not yours", which RLS makes identical.
  if (!match) notFound();

  const isSubmitter = match.submitter.id === viewer.id;
  const isOpponent = match.opponent.id === viewer.id;
  const role = await getGroupRole(match.group.id);
  const canVoid = role === "organizer" && match.status === "confirmed";
  const canEdit =
    isSubmitter && ["pending", "rejected", "expired"].includes(match.status);
  const rated = Object.keys(match.ratingDeltas).length > 0;

  return (
    <>
      <PageHeader
        title={`${match.submitter.name} v ${match.opponent.name}`}
        back={{ href: "/matches", label: "Matches" }}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <MatchStatusBadge status={match.status} />
            <span>
              <Link href={`/groups/${match.group.id}`} className="underline">
                {match.group.name}
              </Link>{" "}
              · {formatPlayedOn(match.playedOn)}
            </span>
          </span>
        }
      />

      {submitted ? (
        <Alert tone="positive" title="Sent for confirmation">
          {match.opponent.name} has {EXPIRY_DAYS} days to confirm or reject it.
        </Alert>
      ) : null}
      {updated ? (
        <Alert tone="positive" title="Correction sent">
          {match.opponent.name} has been asked to confirm the corrected score.
        </Alert>
      ) : null}

      {isOpponent && match.status === "pending" ? (
        <Alert
          tone="warning"
          title={`${match.submitter.name} is waiting for you to confirm this score`}
          action={
            <div className="flex flex-wrap gap-3">
              <ConfirmMatchButton
                matchId={match.id}
                score={describeMatch(match)}
              />
              <RejectMatchButton matchId={match.id} />
            </div>
          }
        >
          Confirm it if it is right. Reject it if anything is wrong, and{" "}
          {match.submitter.name} can correct it.
        </Alert>
      ) : null}

      {isSubmitter && match.status === "rejected" ? (
        <Alert
          tone="critical"
          title={`${match.opponent.name} rejected this score`}
        >
          {match.rejectionReason ? `“${match.rejectionReason}” ` : null}
          Correct it and send it again, or withdraw it.
        </Alert>
      ) : null}

      {match.status === "expired" ? (
        <Alert tone="info" title="This submission expired">
          {match.opponent.name} did not respond within {EXPIRY_DAYS} days, so it
          does not count.{" "}
          {isSubmitter ? "Edit it to send it again, or withdraw it." : null}
        </Alert>
      ) : null}

      {match.status === "voided" ? (
        <Alert tone="info" title="This match was voided">
          {match.voidReason} It no longer counts toward ratings.
        </Alert>
      ) : null}

      <Panel className="p-5 sm:p-8">
        <Scoreline match={match} size="lg" />
      </Panel>

      {canEdit || canVoid ? (
        <div className="flex flex-wrap gap-3">
          {canEdit ? (
            <ButtonLink href={`/matches/${match.id}/edit`} variant="secondary">
              <PencilSimpleIcon aria-hidden weight="bold" className="size-4" />
              {match.status === "pending" ? "Edit score" : "Correct and resend"}
            </ButtonLink>
          ) : null}
          {canEdit ? <WithdrawMatchButton matchId={match.id} /> : null}
          {canVoid ? <VoidMatchButton matchId={match.id} /> : null}
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Rating impact">
          {rated ? (
            <dl className="flex flex-col gap-3">
              {[match.submitter, match.opponent].map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-4"
                >
                  <dt>{player.name}</dt>
                  <dd>
                    <RatingDelta value={match.ratingDeltas[player.id]} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted">
              {match.outcome === "walkover"
                ? "Walkovers are not rated, because no tennis was played."
                : match.status === "voided"
                  ? "Voided matches do not count toward ratings."
                  : "Ratings change once the score is confirmed."}
            </p>
          )}
          <p className="text-muted text-sm">
            Overall rating change. Ratings update in the order matches are
            confirmed, not the date they were played, so older results never
            rewrite what came after them.
          </p>
        </Section>

        <Section title="History">
          <ol className="border-line flex flex-col gap-4 border-l-2 pl-5">
            {timeline(match).map((event) => (
              <li key={event.label} className="flex flex-col gap-0.5">
                <span className="text-ink-strong font-semibold">
                  {event.label}
                </span>
                <span className="text-muted text-sm">
                  {formatDate(event.at)}
                </span>
                {event.detail ? (
                  <span className="text-sm">“{event.detail}”</span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="text-muted text-sm">
            Outcome: {outcomeLabels[match.outcome]}
          </p>
        </Section>
      </div>
    </>
  );
}
