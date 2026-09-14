# Next steps

A roadmap from the current foundation to a working pilot. Last revised 2026-09-14 on
`feature/pilot-nextsteps` from `main` at `0e5bebe`. Milestones A and B were already
complete. Matches, ratings, and the functional application shell are implemented on this
branch. Final visual design remains deliberately deferred.

Read this alongside [`docs/product-questions.md`](docs/product-questions.md), which
records the resolved product decisions,
[`docs/decisions/0001-online-first-pwa.md`](docs/decisions/0001-online-first-pwa.md),
which fixes the delivery model as an online-first PWA, and
[`docs/decisions/0002-match-immutability-and-derived-ratings.md`](docs/decisions/0002-match-immutability-and-derived-ratings.md),
which fixes match immutability and derived ratings.

---

## 1. Where the repository actually is

### What exists and works

| Area       | State                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16.3.4, React 19.3.0, App Router, Tailwind v4, TypeScript 6.0 strict                                               |
| Routes     | Signed-out welcome/auth routes plus dashboard, groups, match history/detail/edit, global and group standings, and profile  |
| Matches    | Atomic submit/edit/withdraw/confirm/reject/void RPC lifecycle with legal best-of-three scores and 14-day pending expiry    |
| Ratings    | Derived 1500/K32 Elo ordered by confirmation, rating history, MOV fixtures, retirement/walkover/void semantics             |
| Security   | RLS, explicit RPC/table grants, security-invoker standings view, serialized membership and confirmation mutations          |
| Tests      | 63 application tests, 198 pgTAP assertions, four overlapping-transaction checks, and desktop/mobile browser coverage       |
| Operations | Structured sanitized errors, isolated recovery drill, two migrated cloud environments, runbooks, CI, and type drift checks |

### Remaining launch prerequisites

- Enable the prepared GitHub Actions deployment jobs and complete authenticated preview
  and production smoke tests with two real pilot accounts.
- Complete the final frontend design pass and installed-PWA checks on physical iOS and
  Android devices.

### Known defects and gaps in what does exist

| #   | Issue                                                                                                                                                                                                                                                                                    | Status                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CI ran `typecheck` before `build`, so `.next/types` did not exist and the global `LayoutProps` helper was undefined. Every pull request failed the `quality` check.                                                                                                                      | **Fixed.** Merged to `main` as pull request #4                                                                                                  |
| 2   | Three Dependabot pull requests (#1, #2, #3) were open and red, blocked by defect 1.                                                                                                                                                                                                      | **Resolved.** #1 and #2 auto-closed; #3 superseded by the regrouping in #12                                                                     |
| 6   | Dependabot bundled `@types/node`, `eslint`, and `typescript` in one development-dependency group, so a TypeScript bump no tool could accept held every unrelated update hostage.                                                                                                         | **Fixed** in pull request #12. TypeScript now arrives alone; `@types/node` majors are pinned to the runtime                                     |
| 3   | `createSupabaseServerClient()` silently swallows cookie writes ([`src/lib/supabase/server.ts:20-26`](src/lib/supabase/server.ts#L20-L26)). Without a proxy that refreshes sessions, logins expire silently.                                                                              | **Fixed.** `proxy.ts` merged to `main` as pull request #6                                                                                       |
| 4   | E2E coverage was Chromium desktop only, on a product whose primary surface is an installed mobile PWA.                                                                                                                                                                                   | **Fixed on this branch.** Desktop and mobile projects cover auth routing and the real match loop. Physical-device installation remains pending. |
| 7   | A removed member could rejoin with the invite code they already knew, silently undoing the removal. Found by clicking through the app, not by any test.                                                                                                                                  | **Fixed** in pull request #8 (`removed_by`)                                                                                                     |
| 5   | No `.github/workflows` job runs against a real Supabase instance, so RLS policies will have no CI enforcement by default.                                                                                                                                                                | **Fixed.** The `database` job in `ci.yml` merged as pull request #6. Milestone B adds its policy tests to `supabase/tests/`, not the job        |
| 8   | `eslint-config-next` vendors dependency constraints that cap ESLint and TypeScript majors.                                                                                                                                                                                               | ESLint 10 remains intentionally held. PR #19 proposes supported TypeScript 6 and has green CI, but repository rules require one approval.       |
| 9   | This working copy lives under `~/Desktop`, which iCloud Drive syncs. iCloud resolves conflicts by writing `name 2.ext` duplicates, and duplicates landing in `.next/types/` break `typecheck` locally with `Duplicate identifier 'LayoutProps'`. CI is unaffected — it checks out clean. | **Open, local only.** `rm -rf .next` clears it; moving the repo off the synced path fixes it                                                    |

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

Account deletion still deliberately cascades match records. The earlier shared-database
exception is retired for the pilot: preview and production require separate projects.

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

**Current:** `main` is green. Pull request #19 merged its isolated TypeScript 6 update.
Pull request #20 contains the pilot work and has green quality and database checks; the
repository requires Mateo's approval before merge.

1. ~~Merge `fix/ci-bootstrap`.~~ Landed as pull request #4. `typecheck` now runs
   `next typegen && tsc --noEmit`, the pattern Next 16 documents for type-checking route
   types in CI without a full build.
2. ~~Merge or close Dependabot #1 and #2.~~ Both auto-closed once the `actions/checkout`
   and `actions/setup-node` v7 bumps landed, exactly as expected.
3. ~~Decide what to do about the grouped development-dependency bump.~~ Resolved by
   pull request #12, which took the split: TypeScript is excluded from the
   `development-dependencies` group and arrives as its own pull request, and
   `@types/node` majors are ignored so they track the Node runtime in `.nvmrc` rather
   than the newest Node release. Pull requests #3 and #11 were closed as superseded.

### The standing caveat: the `eslint-config-next` ceiling

Two development dependencies cannot be upgraded, and neither is our code's fault.
`eslint-config-next@16.3.4` vendors its own copies of `typescript-eslint` and
`eslint-plugin-react`, so their compatibility is what actually binds:

| Dependency   | Held at | Why                                                                                                                                                                                | Clears when                                                               |
| ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `eslint`     | 9.x     | ESLint 10 removed `context.getFilename()`, which `eslint-plugin-react` still calls. Every rule in that plugin throws on load, so `npm run lint` exits 2 before linting anything.   | `eslint-config-next` ships a release with a patched `eslint-plugin-react` |
| `typescript` | 6.x     | TypeScript 6 is supported; TypeScript 7 remains outside the current parser range ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)). | `typescript-eslint` ships TS >= 7.1 support                               |

ESLint 10 is held at the incompatible major. Pull request #19 isolated and merged the
supported TypeScript 6 update.

**Done when:** the pilot branch has green CI and the required approval.

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

**Status: implemented and database-reviewed on this branch.**

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

**Status: functionally implemented. Final visual design and physical-device checks are pending.**

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

**Status: implemented and database-reviewed on this branch.**

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

**Status: cloud databases and initial Vercel production deployment provisioned.**

- The scripted synthetic backup/restore drill compares content, schema, security metadata,
  ratings, and restored policy tests in two isolated databases.
- Server and client-boundary errors emit bounded, sanitized structured runtime events.
- Environment, deployment, rollback, recovery, and device runbooks live under
  `docs/operations/`.
- CI exercises database policies, real overlapping transactions, generated-type drift,
  and isolated desktop/mobile match flows.
- Separate preview and production Supabase Cloud projects were created and migrated on
  2026-09-14. Cloud recovery rehearsal, deployment smoke tests, and physical devices
  remain external launch steps.
- Vercel has independent Preview and Production environment values. The initial branch
  deployment is live at `https://tennis-app-vert.vercel.app`, and a protected preview is
  live at `https://tennis-js5sxxkxv-max-be74.vercel.app`. The organization owner controls
  GitHub App installation, so prebuilt-output GitHub Actions jobs provide automatic
  deployments instead. Encrypted repository secrets, authenticated smoke checks, and a
  post-merge production deployment remain.

---

## 10. Suggested order

```
Milestone 0  ──▶  decisions and TypeScript 6 landed (done)
                        │
Milestone A (auth, proxy.ts, Supabase CLI, migrations) — done, pull request #6
                        │
Milestone B (groups, RLS policies and policy tests) — done, pull requests #7 and #8
                        │
Milestone C (matches, standings) ══ Milestone D (functional shell) — implemented
                        │
Milestone E (ratings) — implemented
                        │
Milestone F (cloud databases and initial Vercel deployment ready)
```

The current edge is application rollout: enable the prepared deployment jobs, run the
authenticated preview smoke test with two real pilot accounts, obtain the required review,
merge #20, verify the merge commit's production deployment, and run the production smoke
and device checks. No real pilot data belongs in the local test stack.

---

## 11. Standing rules

Carried from `CONTRIBUTING.md` and the ADR; repeated because they are easy to skip under
delivery pressure.

- Every user-data table ships with RLS policies and policy tests in the same pull request.
- Ratings are derived. A pull request adding a stored `rating` column needs a new
  decision record.
- No seeded or destructive end-to-end tests against any hosted Supabase project.
- Service-role keys and database passwords are server-only and never carry a
  `NEXT_PUBLIC_` prefix.
- Run the full local gate before requesting review: `format:check`, `lint`, `typecheck`,
  `test`, `build`, plus `test:e2e` when routes, metadata, the manifest, or visible UI change.
- A local `typecheck` failure naming `LayoutProps` or a `.d 2.ts` file is defect 9, not a
  type error. Run `rm -rf .next` and re-run before chasing it.
- This Next.js version differs from what most published guides and training data assume.
  Check `node_modules/next/dist/docs/` before writing against a remembered API — the
  `middleware` to `proxy` rename in Milestone A is exactly this trap.
- Every screen requires the network by design. Do not add caching of authenticated
  records, queued submissions, or background sync without a new decision record.
