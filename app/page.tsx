const matchLoop = [
  {
    number: "01",
    title: "Log the score",
    detail: "Enter the sets. The rest of the match record is derived for you.",
  },
  {
    number: "02",
    title: "Confirm the result",
    detail: "Your opponent verifies the score before it reaches the standings.",
  },
  {
    number: "03",
    title: "Watch the table move",
    detail:
      "Group records and global ratings update from the same trusted result.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[var(--chalk)] text-[var(--ink)]">
      <header className="relative z-10 mx-auto flex w-full max-w-[90rem] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a
          href="#top"
          className="group inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--clay)]"
          aria-label="Tennis App home"
        >
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span className="text-sm font-semibold tracking-[0.2em] uppercase">
            Tally / Tennis
          </span>
        </a>
        <p className="hidden text-xs font-semibold tracking-[0.16em] text-[var(--muted)] uppercase sm:block">
          Private pilot · 2026
        </p>
      </header>

      <main id="top">
        <section className="relative mx-auto grid min-h-[calc(100svh-76px)] w-full max-w-[90rem] items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:py-14">
          <div className="relative z-10 max-w-3xl">
            <p className="mb-6 inline-flex items-center gap-2.5 border border-[color:var(--line)] bg-white/50 px-3 py-2 text-xs font-semibold tracking-[0.12em] uppercase">
              <span className="h-2 w-2 bg-[var(--ball)]" aria-hidden="true" />
              Foundation in progress
            </p>
            <h1 className="font-display max-w-[12ch] text-[clamp(3.5rem,8vw,7.8rem)] leading-[0.86] font-medium tracking-[-0.055em] text-balance">
              Your court. Your crew. Every score counts.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
              Log verified matches, follow fair standings, and find the next
              game—without spreadsheets or guesswork.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:mr-0">
            <div className="court-shadow absolute -inset-10 -z-10" />
            <div
              className="scoreboard"
              aria-label="Example verified match score"
            >
              <div className="flex items-start justify-between gap-8 border-b border-white/18 pb-6">
                <div>
                  <p className="scoreboard-label">Saturday match</p>
                  <p className="mt-2 text-sm text-white/60">
                    Riverside · Court 03
                  </p>
                </div>
                <span className="verified-mark">Verified</span>
              </div>

              <div className="score-row mt-8">
                <div>
                  <p className="scoreboard-label">Player</p>
                  <p className="mt-2 text-xl font-semibold sm:text-2xl">
                    M. Rivera
                  </p>
                </div>
                <div className="sets" aria-label="Set scores 6, 3, 7">
                  <span>6</span>
                  <span className="set-lost">3</span>
                  <span className="set-won">7</span>
                </div>
              </div>

              <div className="score-row border-t border-white/12 pt-7">
                <div>
                  <p className="scoreboard-label">Challenger</p>
                  <p className="mt-2 text-xl font-semibold sm:text-2xl">
                    J. Park
                  </p>
                </div>
                <div className="sets" aria-label="Set scores 4, 6, 5">
                  <span className="set-lost">4</span>
                  <span>6</span>
                  <span className="set-lost">5</span>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-white/18 pt-6">
                <p className="scoreboard-label">Global rating</p>
                <p className="font-display text-2xl tracking-tight text-[var(--ball)]">
                  +18
                </p>
              </div>
            </div>
            <div className="court-lines" aria-hidden="true">
              <span className="court-net" />
              <span className="court-service court-service-left" />
              <span className="court-service court-service-right" />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="match-loop-title"
          className="border-y border-[var(--line)] bg-[var(--paper)]"
        >
          <div className="mx-auto w-full max-w-[90rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
            <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">The first rally</p>
                <h2
                  id="match-loop-title"
                  className="font-display mt-3 max-w-xl text-4xl leading-none tracking-[-0.035em] sm:text-5xl"
                >
                  One score. Three clean steps.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
                Built around the result players already know—not a second set of
                stats to maintain.
              </p>
            </div>

            <ol className="grid border-t border-[var(--line)] md:grid-cols-3">
              {matchLoop.map((step) => (
                <li
                  key={step.number}
                  className="process-step border-b border-[var(--line)] py-8 md:border-r md:border-b-0 md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
                >
                  <span className="font-mono text-xs text-[var(--clay)]">
                    {step.number}
                  </span>
                  <h3 className="mt-8 text-xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--ink)] text-white">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col justify-between gap-4 px-5 py-8 text-xs tracking-[0.08em] text-white/55 uppercase sm:flex-row sm:px-8 lg:px-12">
          <p>Tally Tennis · Built for the next match</p>
          <p>Online-first PWA</p>
        </div>
      </footer>
    </div>
  );
}
