import Image from "next/image";
import Link from "next/link";

import { TennyLockup, TennyMark } from "@/src/components/brand";
import { MatchCard } from "@/src/components/matches/match-card";
import { StandingsTable } from "@/src/components/ratings/standings-table";
import { ButtonLink } from "@/src/components/ui/button";
import type { MatchView } from "@/src/lib/matches/types";
import { rankStandings, type Standing } from "@/src/lib/ratings/types";

// Illustrations only, rendered with the production components and captioned
// as examples. No page presents these as anyone's real results.
const exampleMatch: MatchView = {
  id: "example",
  group: { id: "example", name: "Riverside Ladder" },
  playedOn: "2026-09-12",
  outcome: "completed",
  format: "match",
  status: "confirmed",
  submitter: { id: "priya", name: "Priya Raman" },
  opponent: { id: "tomas", name: "Tomás Ortega" },
  winnerId: "priya",
  sets: [
    { a: 6, b: 4 },
    { a: 3, b: 6 },
    { a: 7, b: 6, tiebreak: 5 },
  ],
  submittedAt: "2026-09-12T18:02:00Z",
  confirmedAt: "2026-09-12T19:40:00Z",
  rejectedAt: null,
  rejectionReason: null,
  voidedAt: null,
  voidReason: null,
  ratingDeltas: {},
};

const exampleStandings: Standing[] = rankStandings([
  {
    playerId: "priya",
    name: "Priya Raman",
    rating: 1561.4,
    played: 9,
    wins: 7,
    losses: 2,
    form: ["W", "W", "L", "W", "W"],
    lastDelta: 14.2,
    active: true,
    avatarUrl: null,
  },
  {
    playerId: "tomas",
    name: "Tomás Ortega",
    rating: 1538.2,
    played: 11,
    wins: 7,
    losses: 4,
    form: ["L", "W", "W", "L", "W"],
    lastDelta: -14.2,
    active: true,
    avatarUrl: null,
  },
  {
    playerId: "grace",
    name: "Grace Whitfield",
    rating: 1512.6,
    played: 8,
    wins: 4,
    losses: 4,
    form: ["W", "L", "W", "L", "L"],
    lastDelta: 9.8,
    active: true,
    avatarUrl: null,
  },
  {
    playerId: "okafor",
    name: "Chidi Okafor",
    rating: 1512.9,
    played: 6,
    wins: 3,
    losses: 3,
    form: ["L", "W", "L", "W", "W"],
    lastDelta: -6.1,
    active: true,
    avatarUrl: null,
  },
  {
    playerId: "lena",
    name: "Lena Brandt",
    rating: 1471.3,
    played: 10,
    wins: 3,
    losses: 7,
    form: ["L", "L", "W", "L", "L"],
    lastDelta: -9.8,
    active: true,
    avatarUrl: null,
  },
]);

const steps = [
  {
    verb: "Log",
    detail:
      "Enter the sets straight after you come off court. Tenny checks the score is one tennis allows.",
  },
  {
    verb: "Confirm",
    detail:
      "Your opponent confirms or rejects it. Nothing counts until both of you agree, and a confirmed result never changes.",
  },
  {
    verb: "Rank",
    detail:
      "The standings move. Every rating change traces back to a match both players signed off.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="max-w-content mx-auto flex w-full items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-8">
        <Link
          href="/"
          aria-label="Tenny home"
          className="flex min-h-11 items-center"
        >
          <TennyLockup height={28} alt="" priority />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <ButtonLink href="/login" variant="quiet" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Create account
          </ButtonLink>
        </nav>
      </header>

      <main id="main" className="flex flex-col">
        <section className="max-w-content mx-auto grid w-full grid-cols-1 items-center gap-12 px-4 pt-10 pb-16 sm:px-8 lg:min-h-[min(40rem,calc(100dvh-5rem))] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-8">
          <div className="flex flex-col gap-6">
            <h1 className="type-display max-w-[13ch] text-balance">
              Scores both players agree on.
            </h1>
            <p className="text-muted max-w-[34ch] text-lg sm:text-xl">
              Log a match, your opponent confirms it, and your group&apos;s
              standings move on results everyone trusts.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/signup">Create account</ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                Sign in
              </ButtonLink>
            </div>
          </div>

          <figure className="relative flex flex-col gap-3 lg:pl-8">
            <div
              aria-hidden
              className="struck-in -mb-6 self-start pl-2 sm:-mb-10"
            >
              <TennyMark height={150} alt="" priority />
            </div>
            <div className="shadow-(--shadow-overlay)">
              <MatchCard match={exampleMatch} href={null} size="lg" />
            </div>
            <figcaption className="text-muted text-sm">
              An example of a confirmed match.
            </figcaption>
          </figure>
        </section>

        <section
          aria-labelledby="how-title"
          className="bg-surface border-line border-y"
        >
          <div className="max-w-content mx-auto grid w-full grid-cols-1 gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-24">
            <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
              <h2 id="how-title" className="type-title max-w-[16ch]">
                One result, agreed once.
              </h2>
              <p className="text-muted max-w-prose">
                No spreadsheet, and no arguing over what the score was last
                Tuesday.
              </p>
            </div>
            <ol className="border-line flex flex-col border-t">
              {steps.map((step) => (
                <li
                  key={step.verb}
                  className="border-line grid grid-cols-1 gap-2 border-b py-8 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8"
                >
                  <h3 className="type-title text-accent">{step.verb}</h3>
                  <p className="max-w-prose text-lg">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="standings-title"
          className="max-w-content mx-auto flex w-full flex-col gap-8 px-4 py-16 sm:px-8 lg:py-24"
        >
          <div className="flex max-w-prose flex-col gap-4">
            <h2 id="standings-title" className="type-title">
              Standings that explain themselves.
            </h2>
            <p className="text-muted text-lg">
              Ratings only move on confirmed results, in the order they were
              confirmed. Your group&apos;s table and your overall rating come
              from the same matches.
            </p>
          </div>
          <figure className="flex flex-col gap-3">
            <StandingsTable
              standings={exampleStandings}
              caption="Example group standings"
              linkPlayers={false}
            />
            <figcaption className="text-muted text-sm">
              Example standings. Players on the same displayed rating share a
              rank.
            </figcaption>
          </figure>
        </section>

        <section
          aria-labelledby="install-title"
          className="max-w-content mx-auto w-full px-4 pb-16 sm:px-8 lg:pb-24"
        >
          <div className="border-line bg-surface grid grid-cols-1 items-center gap-8 border p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-10">
            <Image
              src="/brand/tenny-app-icon.svg"
              alt=""
              width={96}
              height={96}
              className="rounded-[22%]"
            />
            <div className="flex flex-col gap-4">
              <h2 id="install-title" className="type-title">
                Lives on your home screen.
              </h2>
              <p className="text-muted max-w-prose">
                Tenny installs from your browser, with no app store. It needs a
                connection to load or save, so every score you see is current.
              </p>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-ink-strong font-semibold">iPhone</dt>
                  <dd className="text-muted">
                    In Safari, tap Share, then Add to Home Screen.
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-strong font-semibold">Android</dt>
                  <dd className="text-muted">
                    In Chrome, open the menu, then Install app.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line mt-auto border-t">
        <div className="max-w-content mx-auto flex w-full flex-wrap items-center justify-between gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
          <TennyLockup height={20} />
          <p className="text-muted text-sm">
            Verified scores and fair standings for your tennis group.
          </p>
        </div>
      </footer>
    </div>
  );
}
