# Next steps

A roadmap from the current foundation to a working pilot. Written 2026-09-06 against
commit `5886385` on `fix/ci-bootstrap`, with Milestone 0 status updated after
pull request #4 merged, and Milestone A and B status updated after pull requests #6,
#7 and #8 merged.

Read this alongside [`docs/product-questions.md`](docs/product-questions.md), which
records the resolved product decisions,
[`docs/decisions/0001-online-first-pwa.md`](docs/decisions/0001-online-first-pwa.md),
which fixes the delivery model as an online-first PWA, and
[`docs/decisions/0002-match-immutability-and-derived-ratings.md`](docs/decisions/0002-match-immutability-and-derived-ratings.md),
which fixes match immutability and derived ratings.

---

## 1. Where the repository actually is

### What exists and works

| Area         | State                                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | Next.js 16.3.4, React 19.2.8, App Router, Tailwind v4, TypeScript strict                                                                                                                           |
| Routes       | `/` landing page, `/signup`, `/login`, `/reset-password`, `/update-password`, `/auth/callback`, `/dashboard`, `/groups`, `/groups/[id]`, plus `error.tsx`, `not-found.tsx`, `manifest.webmanifest` |
| PWA          | Manifest with standalone display and 192/512 maskable icons                                                                                                                                        |
| Supabase     | Browser and server client factories, `@supabase/ssr`, CLI stack in `supabase/`, `profiles` and `groups` migrations with RLS, generated types committed                                             |
| Groups       | Create, join by invite code, roster, promote/demote, remove with restore, organizer transfer, invite rotation                                                                                      |
| Auth         | Email/password signup with confirmation, sign-in, reset, sign-out; `proxy.ts` refreshes sessions                                                                                                   |
| Env          | `readPublicEnv()` validates presence and requires HTTPS except on loopback, so the local stack works                                                                                               |
| Tests        | 6 Vitest files / 35 tests; 7 Playwright specs (Chromium only); 41 pgTAP policy tests across 2 files                                                                                                |
| CI           | `quality` job: format, lint, typecheck, unit, build, e2e. `database` job: applies migrations to an empty Supabase stack and runs `supabase test db`                                                |
| Repo process | CODEOWNERS, PR template, issue templates, Dependabot, CONTRIBUTING working agreement                                                                                                               |

### What does not exist yet

Authentication landed in Milestone A and groups in Milestone B. The match loop the
landing page promises still does not:

- **No matches, standings, or ratings.** Milestone C is the first of these, and the first
  consumer of the `is_group_member()` predicate that Milestone B exists to provide.
- **No application shell.** The landing page is still static marketing copy, and
  `/dashboard` is a placeholder that links to groups. Milestone D replaces it.
- **No environments split.** No hosted Supabase project exists at all; development runs
  against the local CLI stack. Preview and production projects are required before a
  single pilot user record is stored.

### Known defects and gaps in what does exist

| #   | Issue                                                                                                                                                                                                       | Status                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CI ran `typecheck` before `build`, so `.next/types` did not exist and the global `LayoutProps` helper was undefined. Every pull request failed the `quality` check.                                         | **Fixed.** Merged to `main` as pull request #4                                                                                           |
| 2   | Three Dependabot pull requests (#1, #2, #3) were open and red, blocked by defect 1.                                                                                                                         | #1 and #2 auto-closed. #3 is red for a different reason — see defect 6                                                                   |
| 6   | Dependabot #3 bundles `@types/node`, `eslint`, and `typescript` in one development-dependency group. Its TypeScript 7.0 bump fails lint with `typescript-eslint does not support TS 7.0`.                   | Blocks the last of Milestone 0 — decision needed                                                                                         |
| 3   | `createSupabaseServerClient()` silently swallows cookie writes ([`src/lib/supabase/server.ts:20-26`](src/lib/supabase/server.ts#L20-L26)). Without a proxy that refreshes sessions, logins expire silently. | **Fixed.** `proxy.ts` merged to `main` as pull request #6                                                                                |
| 4   | E2E coverage is Chromium desktop only, on a product whose primary surface is an installed mobile PWA.                                                                                                       | Add a mobile viewport project in Milestone C                                                                                             |
| 7   | A removed member could rejoin with the invite code they already knew, silently undoing the removal. Found by clicking through the app, not by any test.                                                     | **Fixed** in pull request #8 (`removed_by`)                                                                                              |
| 5   | No `.github/workflows` job runs against a real Supabase instance, so RLS policies will have no CI enforcement by default.                                                                                   | **Fixed.** The `database` job in `ci.yml` merged as pull request #6. Milestone B adds its policy tests to `supabase/tests/`, not the job |

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

**Mostly done.** `main` carries the CI fix and its last three runs are green.

1. ~~Merge `fix/ci-bootstrap`.~~ Landed as pull request #4. `typecheck` now runs
   `next typegen && tsc --noEmit`, the pattern Next 16 documents for type-checking route
   types in CI without a full build.
2. ~~Merge or close Dependabot #1 and #2.~~ Both auto-closed once the `actions/checkout`
   and `actions/setup-node` v7 bumps landed, exactly as expected.
3. **Dependabot #3 remains open and red**, but not because of defect 1. It fails lint with
   `typescript-eslint does not support TS 7.0`. This is a real upstream incompatibility
   introduced by the pull request's own TypeScript bump, so rebasing will not fix it.

   Two ways out, and this is a decision rather than a chore:

   - **Split TypeScript out of the development-dependency group** in
     `.github/dependabot.yml`, merge the `@types/node` and `eslint` bumps now, and let
     TypeScript arrive as its own pull request that stays red until typescript-eslint
     ships support. Keeps the other updates flowing.
   - **Hold #3 entirely** until typescript-eslint supports TypeScript 7.0, accepting that
     `@types/node` and `eslint` sit stale behind it.

   Prefer the split. A grouped pull request that can never go green blocks unrelated
   updates indefinitely, and the group exists to reduce noise, not to couple upgrades that
   have different readiness dates.

**Done when:** `main` is green and no pull request is open.

---

## 4. Milestone A — Authentication

**Status: done.** Merged to `main` as pull request #6.

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

**Done**, pull requests #7 and #8.

**Goal:** the invite-only group that the pilot depends on.

This milestone is the security spine of the product. Every later table inherits the
"can this user see this group" predicate established here, so the policies deserve more
care than the UI.

### What Milestone C inherits

- `public.is_group_member(uuid)` and `public.is_group_organizer(uuid)` are the single
  definition of membership. Reuse them in the `matches` policies rather than writing a
  fresh subquery — they are `SECURITY DEFINER` precisely so a policy on a table can ask
  about membership without recursing.
- Membership mutations live in `SECURITY DEFINER` functions, not `UPDATE` policies.
  `group_members` has a `SELECT` policy and nothing else, so a crafted direct write has
  no path. Match confirmation has the same shape of rule ("only a participant, and never
  your own submission") and should follow the same pattern.
- A departed member keeps their row with `left_at` set, and `removed_by` distinguishes
  removal from leaving. Standings must include departed members' past results.

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
   (#3 open)
                        │
Milestone A (auth, proxy.ts, Supabase CLI, migrations) — done, pull request #6
                        │
Milestone B (groups, RLS policies and policy tests) — done, pull requests #7 and #8
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
