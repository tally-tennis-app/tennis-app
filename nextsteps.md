# Next steps

A roadmap from the current foundation to a working pilot. Written 2026-09-06 against
commit `5886385` on `fix/ci-bootstrap`.

Read this alongside [`docs/product-questions.md`](docs/product-questions.md), which
records the resolved product decisions,
[`docs/decisions/0001-online-first-pwa.md`](docs/decisions/0001-online-first-pwa.md),
which fixes the delivery model as an online-first PWA, and
[`docs/decisions/0002-match-immutability-and-derived-ratings.md`](docs/decisions/0002-match-immutability-and-derived-ratings.md),
which fixes match immutability and derived ratings.

---

## 1. Where the repository actually is

### What exists and works

| Area         | State                                                                                 |
| ------------ | ------------------------------------------------------------------------------------- |
| Framework    | Next.js 16.3.4, React 19.2.8, App Router, Tailwind v4, TypeScript strict              |
| Routes       | `/` marketing landing page, plus `error.tsx`, `not-found.tsx`, `manifest.webmanifest` |
| PWA          | Manifest with standalone display and 192/512 maskable icons                           |
| Supabase     | Browser and server client factories, `@supabase/ssr`                                  |
| Env          | `readPublicEnv()` validates presence and enforces an HTTPS Supabase URL               |
| Tests        | 5 Vitest files / 9 tests; 1 Playwright smoke test (Chromium only)                     |
| CI           | `quality` job: format, lint, typecheck, unit, build, e2e                              |
| Repo process | CODEOWNERS, PR template, issue templates, Dependabot, CONTRIBUTING working agreement  |

### What does not exist yet

Everything the product actually is:

- **No database.** No tables, no migrations directory, no Supabase CLI, no seed data, no
  generated database types. Nothing has ever been written to Supabase.
- **No authentication.** No sign-in route, no session handling, no `proxy.ts`, no protected
  routes, no concept of a current user anywhere in the codebase.
- **No product surface.** The landing page is static marketing copy. It describes a
  three-step match loop — log, confirm, watch the table move — and none of those three
  steps exist.
- **No authorization.** `CONTRIBUTING.md` requires RLS policies and policy tests in the
  same pull request as any user-data table. No policies exist because no tables exist.
- **No environments split.** Previews and production may still share the empty development
  Supabase project. A separate production project is required before a single pilot user
  record is stored.

### Known defects and gaps in what does exist

| #   | Issue                                                                                                                                                                                                       | Status                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | CI ran `typecheck` before `build`, so `.next/types` did not exist and the global `LayoutProps` helper was undefined. Every pull request failed the `quality` check.                                         | **Fixed** on `fix/ci-bootstrap` (`5886385`), needs merge |
| 2   | Three Dependabot pull requests (#1, #2, #3) are open and all red, blocked by defect 1.                                                                                                                      | Unblocked once `fix/ci-bootstrap` lands                  |
| 3   | `createSupabaseServerClient()` silently swallows cookie writes ([`src/lib/supabase/server.ts:20-26`](src/lib/supabase/server.ts#L20-L26)). Without a proxy that refreshes sessions, logins expire silently. | Blocks Milestone A                                       |
| 4   | E2E coverage is Chromium desktop only, on a product whose primary surface is an installed mobile PWA.                                                                                                       | Add a mobile viewport project in Milestone C             |
| 5   | No `.github/workflows` job runs against a real Supabase instance, so RLS policies will have no CI enforcement by default.                                                                                   | Must be solved inside Milestone B, not after             |

---

## 2. Decisions — resolved

Nothing blocks implementation any more. The product decisions are recorded in
[`docs/product-questions.md`](docs/product-questions.md); the reasoning behind the two
that shape the schema is in
[ADR 0002](docs/decisions/0002-match-immutability-and-derived-ratings.md).

The three that were blocking, and what they landed on:

| Was                             | Resolution                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 — match score representation | Best-of-three full sets, tiebreak at 6-6 in every set. Outcomes `completed` / `retired` / `walkover`. Date played, not timestamp.                                   |
| D2 — rating replay semantics    | **A confirmed match is immutable**, so no replay exists. Ratings are a derived fold ordered by `confirmed_at`. Start 1500, `K = 32`, margin via bounded game share. |
| D3 — group membership rules     | Reusable invite code with a 30-day expiry, organizer-rotated. Departed members stay in standings as inactive. Multiple groups per user. Account deletion cascades.  |

Two tradeoffs were accepted with known costs and revisit triggers — account deletion
hard-deleting matches, and one Supabase project serving both previews and production.
Both are recorded in ADR 0002. Neither is an oversight.

### The one detail that is easy to get wrong

The rating fold orders by **`confirmed_at`, not `played_on`**. Ordering by the date the
match was played would let a backdated entry rewrite every rating after it, which is the
exact problem immutability was chosen to eliminate. This is a silent correctness bug, not
a preference, and Milestone E carries a dedicated regression test for it.

### Deferred, deliberately

Naming and trademark clearance, doubles, offline submission, push notifications,
generated avatars, tournaments, and social login. All already deferred in
`docs/product-questions.md` and the ADRs. Do not let them expand the pilot.

---

## 3. Milestone 0 — Unblock the pipeline

**Goal:** a green `main` and an empty pull request queue.

1. Open a pull request for `fix/ci-bootstrap` and merge it. It makes `typecheck` run
   `next typegen && tsc --noEmit`, which is the pattern Next 16 documents for
   type-checking route types in CI without a full build.
2. Merge or close Dependabot #1 and #2. The branch already bumps `actions/checkout` and
   `actions/setup-node` to v7, so once it lands these two are redundant and Dependabot
   will close them on its next run.
3. Rebase Dependabot #3 (development dependencies) and merge once green.

**Done when:** `main` is green and no pull request is open.

---

## 4. Milestone A — Authentication

**Goal:** a real person can sign in, and the app knows who they are.

Use Supabase Auth with email and password, email confirmation on signup, and a display
name captured at signup. No NextAuth, no custom session table.

Magic links were rejected deliberately: a link tapped in a mail client opens the default
browser rather than the installed PWA, so the user ends up signed in in a browser tab
while the app icon on their home screen is still signed out.

### Work

- **`proxy.ts` at the repository root.** In Next.js 16 the `middleware` file convention is
  deprecated and renamed to `proxy`, the export is `proxy` rather than `middleware`, and
  the Edge runtime is not supported there. Most Supabase guides still show
  `middleware.ts`; do not copy them verbatim. This file refreshes the Supabase session on
  every request and writes back the refreshed cookies, which is what makes defect 3
  disappear.
- **Routes:** `/signup`, `/login`, `/reset-password`, `/auth/callback` (email
  confirmation), and a sign-out action.
- **`profiles` table:** `id` referencing `auth.users`, `display_name`, `created_at`, with a
  trigger inserting a row on user creation.
- **RLS on `profiles`:** a user reads and updates only their own row.
- **Route protection:** an authenticated area that redirects anonymous visitors to
  `/login`.

### Tooling decision to make here

Adopt the Supabase CLI and commit migrations as plain SQL under `supabase/migrations/`.
Do not add Prisma or Drizzle. The pilot schema is roughly five tables, and RLS policies
have to be written in SQL regardless, so an ORM adds a build step and hides the policies
that are the actual security boundary.

Add `supabase/config.toml`, a `db:reset` script, and generated database types checked into
the repository so `typecheck` catches schema drift.

### Acceptance criteria

- A new account signs up, confirms by email, and signs in.
- A session survives a page reload and a browser restart.
- Signing out clears the session and protected routes redirect to `/login`.
- An unauthenticated request to a protected route never renders authenticated content.
- Policy tests prove one user cannot read another user's profile row.

---

## 5. Milestone B — Groups

**Goal:** the invite-only group that the pilot depends on.

This milestone is the security spine of the product. Every later table inherits the
"can this user see this group" predicate established here, so the policies deserve more
care than the UI.

### Schema

- `groups` — `id`, `name`, `invite_code` (unique), `invite_expires_at`, `created_by`,
  `created_at`.
- `group_members` — `group_id`, `user_id`, `role` (`organizer` | `player`), `joined_at`,
  `left_at` (null means active), primary key on (`group_id`, `user_id`).

### Work

- Create a group; the creator becomes organizer.
- Join by invite code. The code is reusable with a 30-day expiry; the organizer
  regenerates it to revoke or extend. Expiry blocks new joins only.
- Group member list, organizer-only removal, organizer transfer. A group always has at
  least one organizer; the last one cannot leave without transferring.
- A removed member keeps a `left_at` stamp, stays in standings as inactive, and drops off
  the active roster. Their matches are untouched — the alternative silently rewrites
  every remaining member's rating.
- RLS: a user reads `groups` and `group_members` rows only for groups they belong to;
  only organizers mutate membership.

### CI requirement

Resolve defect 5 here. Add a job that starts a local Supabase instance, applies
migrations, and runs policy tests as an unprivileged user. Without it, `CONTRIBUTING.md`'s
"policy tests in the same pull request" rule is unenforceable and will quietly lapse.

### Acceptance criteria

- Two accounts in different groups cannot see each other's group or membership rows,
  proven by a test that authenticates as each and asserts empty results.
- An invalid, expired, or rotated invite code fails to join.
- A non-organizer cannot remove a member, including by calling the API directly.

---

## 6. Milestone C — Matches

**Goal:** the loop the landing page promises — log a score, opponent confirms it.

Two pull requests: schema plus submission, then confirmation plus standings.

### Schema

Singles only for the pilot. Two player columns rather than a participants table; add the
participants table when doubles ships, not before.

- `matches` — `id`, `group_id`, `player_a`, `player_b`, `played_on` (date),
  `outcome` (`completed` | `retired` | `walkover`), `retired_by`, `winner`,
  `status` (`pending` | `confirmed` | `rejected`), `submitted_by`, `confirmed_at`,
  `voided_at`, `voided_by`, `created_at`. CHECK `player_a <> player_b` and
  `submitted_by IN (player_a, player_b)`.
- `match_sets` — `match_id`, `set_number`, `games_a`, `games_b`, `tiebreak_a`,
  `tiebreak_b`, `complete`.

Per-row CHECKs cover sanity and single-set legality. Composite legality — two or three
sets, winner has two, a retirement may end mid-set — spans rows, so it lives in a
`submit_match()` SQL function that inserts the match and its sets atomically. The client
calls that RPC and cannot construct an illegal match by writing to the tables directly.

Prefer normalized `match_sets` over a JSON blob. Standings need to aggregate games won,
and margin-of-victory Elo needs per-set detail; every such query is harder through JSON,
and set score validity can be enforced with a CHECK constraint rather than application
code.

### Work

- Submit a match against another group member.
- The submitter may edit or withdraw their own submission while it is pending.
- The opponent confirms or rejects; only confirmed matches count.
- A pending match older than 14 days displays as expired. This is computed from
  `created_at` — no cron job.
- An organizer may void a confirmed match. The score is never rewritten.
- Match history for a group and for a player.
- Group standings as a SQL view over confirmed matches. A view, not a maintained table —
  there is no volume argument for caching during a pilot.
- RLS: only group members read a group's matches; only a participant confirms, and never
  their own submission. Updates to a confirmed match are refused by policy, not only by
  the UI.

### Acceptance criteria

- A player cannot confirm a match they submitted.
- A pending match does not appear in standings.
- An invalid set score is rejected by the database, not only by the form.
- Playwright covers submit, confirm, and standings movement on a mobile viewport
  (defect 4).

---

## 7. Milestone D — The real application shell

**Goal:** stop shipping a marketing page as the product.

Runs alongside C rather than after it.

- Authenticated navigation: groups, matches, standings, profile.
- Move the current landing page to a signed-out marketing route and make the root route
  redirect authenticated users into the app.
- Loading and empty states for every list, since a pilot group starts with zero matches.
- Accessibility pass: keyboard navigation, focus states, form labels, and error
  announcements. The existing landing page sets a good bar; hold new screens to it.
- Verify the installed PWA on real iOS and Android hardware. Installation is the only
  distribution channel during the pilot, per the ADR.

---

## 8. Milestone E — Ratings

**Goal:** the global Elo the product promises.

- Compute ratings from confirmed, non-void matches ordered by **`confirmed_at`**, as a
  derived computation — a SQL function or view — not a mutable column.
- One function, parameterized by an optional group filter, serves both the global rating
  and per-group standings.
- `K = 32`, starting rating 1500, `MOV_M = 0.25`, all named constants in one place. They
  are calibration knobs and will need tuning against real pilot results.
- Only promote to a stored table when a measurement shows the fold is too slow. At pilot
  volume it is milliseconds.
- Rating history per player, and a rating change shown on each match.
- Hand-computed fixtures: a 1.0× three-setter, a 1.25× double bagel, a skipped walkover,
  a retirement rated on partial games, and a voided match dropping out of the fold.
- **Regression test for the ordering:** submit and confirm a backdated match, then assert
  no prior rating moved. Ordering by `played_on` instead of `confirmed_at` is a silent
  correctness bug.

---

## 9. Milestone F — Pilot readiness

Not optional, and easy to forget until the day of launch.

- Backup and restore verified by an actual restore, not by reading documentation.
- An error reporting path better than the browser console.
- A written rollback plan for a bad production deploy.
- **Revisit the single Supabase project.** Previews currently write to the same database
  as production, an accepted tradeoff in ADR 0002. Splitting it is required before anyone
  outside the pilot group is onboarded.

---

## 10. Suggested order

```
Milestone 0  ──▶  decisions landed as documentation (done)
                        │
Milestone A (auth, proxy.ts, Supabase CLI, migrations)
                        │
Milestone B (groups, RLS, policy-test CI job)
                        │
Milestone C (matches, standings) ══ Milestone D (app shell) — in parallel
                        │
Milestone E (ratings)
                        │
Milestone F (pilot readiness)
```

The critical path is A → B → C. Milestone C must carry `confirmed_at` and `voided_at`
from its first migration even though Milestone E is late — the rating fold depends on
both, and adding them afterwards means migrating live match data.

---

## 11. Standing rules

Carried from `CONTRIBUTING.md` and the ADR; repeated because they are easy to skip under
delivery pressure.

- Every user-data table ships with RLS policies and policy tests in the same pull request.
- Ratings are derived. A pull request adding a stored `rating` column needs a new
  decision record.
- No seeded or destructive end-to-end tests against the shared Supabase project while
  previews and production share it.
- Service-role keys and database passwords are server-only and never carry a
  `NEXT_PUBLIC_` prefix.
- Run the full local gate before requesting review: `format:check`, `lint`, `typecheck`,
  `test`, `build`, plus `test:e2e` when routes, metadata, the manifest, or visible UI change.
- This Next.js version differs from what most published guides and training data assume.
  Check `node_modules/next/dist/docs/` before writing against a remembered API — the
  `middleware` to `proxy` rename in Milestone A is exactly this trap.
- Every screen requires the network by design. Do not add caching of authenticated
  records, queued submissions, or background sync without a new decision record.
