# Next steps: complete the Tenny frontend

This roadmap replaces the earlier feature-level sequence with a frontend delivery plan.
It was revised on 2026-09-18 against `main` at `69cc930` after the Tenny "Struck"
brand direction was delivered in [`Branding.pdf`](Branding.pdf).

The objective is a cohesive, production-ready application rather than a collection of
individually styled pages. The work covers the public site, authentication, the
authenticated shell, dashboard, profile, groups, matches, standings and ratings, and a
tournament experience. Each segment should land as a focused pull request or small set
of pull requests with its own responsive, accessibility, and test acceptance criteria.

Read this alongside:

- [`Branding.pdf`](Branding.pdf), the visual source of truth for the Tenny name, Struck
  ball mark, lockups, icon treatments, and logo usage rules.
- [`docs/product-questions.md`](docs/product-questions.md), which fixes the current
  scoring, confirmation, rankings, group, and authentication behavior.
- [`docs/decisions/0001-online-first-pwa.md`](docs/decisions/0001-online-first-pwa.md),
  which keeps the product an online-first responsive PWA.
- [`docs/decisions/0002-match-immutability-and-derived-ratings.md`](docs/decisions/0002-match-immutability-and-derived-ratings.md),
  which makes confirmed matches immutable and ratings derived.

---

## 1. Current state

### Already working

| Area           | State                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Framework      | Next.js 16.3.4, React 19.3.0, App Router, Tailwind v4, strict TypeScript                                            |
| Authentication | Email/password signup, confirmation, sign-in, reset, sign-out, session refresh, protected routes                    |
| Groups         | Create, join, roster, roles, removal/restore, organizer transfer, invite rotation, RLS and policy tests             |
| PWA            | Standalone manifest and 192/512 maskable icons                                                                      |
| Quality        | Formatting, lint, typecheck, unit, build, E2E, database migrations, and pgTAP policy tests in CI                    |
| Brand          | Tenny Struck ball direction, horizontal and stacked lockups, app icon, favicon treatment, navy/basil/white variants |

### Frontend gaps

- The current public page and placeholder `T` mark predate the Tenny brand.
- `/dashboard` is a signed-in placeholder rather than a useful home screen.
- Auth and group pages are functional but do not share a finished visual system or app
  shell.
- There is no profile screen, matches UI, match score card system, standings UI, ratings
  history, or tournament UI.
- Loading, empty, failure, permission, offline, and destructive-action states are not
  implemented consistently.
- Mobile Chromium is not yet a first-class Playwright target even though the installed
  PWA is the primary product surface.

### Non-frontend dependencies

The interface must not conceal missing product behavior behind static mock data.

- Matches, match sets, confirmation, standings, and rating queries still need their
  database migrations, RLS policies, RPCs, and server-side query layer.
- Tournament rules and data do not yet have an accepted product decision. The existing
  product document explicitly defers round-robin and pool-play tournaments.
- Profile editing needs a safe server action and any additional profile fields must be
  agreed before the schema expands.

Frontend work may begin with typed fixtures for isolated component tests, but a segment
is not complete until its real route uses authorized application data and handles the
full state model.

---

## 2. Product and experience principles

These constraints apply to every segment.

1. **Tenny is the product name.** Remove the temporary "Tennis App" and
   "Tally / Tennis" presentation from user-facing UI as the relevant surfaces are
   rebuilt. Keep the legal repository/package name unchanged unless a separate rename
   is approved.
2. **The Struck ball is the primary mark.** Use the supplied geometry and variants;
   never redraw the seam, trails, proportions, or small-size treatment in CSS.
3. **Mobile-first, desktop-complete.** The installed phone PWA is the primary layout.
   Desktop should use its space deliberately, not stretch the mobile column.
4. **Scores are the visual hero.** Names, set scores, match state, and required action
   must scan in that order. Decorative styling must never compete with the score.
5. **Status is never color-only.** Pending, confirmed, rejected, expired, retired,
   walkover, and voided states need text or icon-and-text labels.
6. **One clear primary action per view.** Submission, confirmation, invitation, and
   tournament management screens must make the next action obvious.
7. **Server truth over optimistic fiction.** A completed action shows pending feedback,
   then reconciles with the server response. Do not show a confirmed match, new rating,
   or changed bracket before the server has accepted it.
8. **Accessible by default.** Target WCAG 2.2 AA, visible keyboard focus, semantic
   landmarks, labelled controls, 44px touch targets, screen-reader announcements for
   async results, reduced-motion support, and sufficient contrast in every logo/color
   variant.
9. **Online-first stays explicit.** Every authenticated screen requires the network.
   Show a useful offline state; do not add cached private records, queued mutations, or
   background sync without a new decision record.
10. **No dead controls or fake data.** Hide or label intentionally unavailable actions.
    Sample content belongs only in tests and development fixtures.

---

## 3. Target information architecture

### Public and account routes

| Route              | Purpose                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `/`                | Tenny marketing landing page for signed-out visitors; redirect signed-in users to `/dashboard` |
| `/login`           | Sign in                                                                                        |
| `/signup`          | Create an account                                                                              |
| `/reset-password`  | Request a reset link                                                                           |
| `/update-password` | Choose a new password after recovery                                                           |
| `/auth/callback`   | Confirmation/recovery callback with a branded processing and failure experience                |

### Authenticated routes

| Route                      | Purpose                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard`               | Personalized overview, required actions, rating snapshot, recent results, and group/tournament activity                                    |
| `/matches`                 | All visible matches with pending-action, status, group, and player filters                                                                 |
| `/matches/new`             | Guided score submission flow                                                                                                               |
| `/matches/[id]`            | Match detail, verification history, score, rating change, and allowed actions                                                              |
| `/standings`               | Global ratings plus a group selector and explanatory rating context                                                                        |
| `/groups`                  | Group switcher, group summaries, create, and join flows                                                                                    |
| `/groups/[id]`             | Group overview with standings, recent matches, roster, and invite affordance                                                               |
| `/groups/[id]/settings`    | Organizer controls, invite management, roles, removal/restore, transfer, and leave flow                                                    |
| `/tournaments`             | Tournament discovery, active/completed sections, and organizer creation entry point                                                        |
| `/tournaments/new`         | Tournament creation flow after the tournament product contract is approved                                                                 |
| `/tournaments/[id]`        | Overview, entrants, draw/rounds, schedule, results, and tournament status                                                                  |
| `/tournaments/[id]/manage` | Organizer-only seeding, draw, scheduling, result, withdrawal, and status controls                                                          |
| `/profile`                 | Personal identity, rating/record summary, group memberships, and match history                                                             |
| `/settings`                | Account details, password/security entry points, appearance/accessibility preferences if added, sign-out, and account deletion information |

On compact screens, use a persistent bottom navigation for Dashboard, Matches, Groups,
and Tournaments, with profile/account access in the app header. On wider screens, move
the same destinations into a left rail. Standings remains reachable from the dashboard,
group views, and the navigation overflow so the primary navigation does not exceed five
items.

---

## 4. Segment 0 - lock the UI contract

**Goal:** remove ambiguity before components multiply.

### Work

- Inventory the supplied logo files and request/export production-ready SVG and PNG
  assets for the full-color mark, one-color mark, reversed mark, horizontal lockup,
  stacked lockup, app icon, and favicon.
- Record exact brand color values and approved typefaces from the brand source. Do not
  sample approximate hex values from a screenshot when source values are available.
- Decide whether the current serif editorial type remains part of the product or is
  replaced by the brand type system.
- Define the app's density, corner, border, elevation, icon, motion, and illustration
  rules in one short UI direction note inside this document or a dedicated design spec.
- Confirm the route inventory above and the compact/wide navigation model.
- Confirm whether the first tournament release is single-elimination singles. This is
  the recommended v1 because round-robin and pool play are already explicitly deferred.
- Define the minimum tournament contract: eligibility, entrant cap, seeding, byes,
  organizer powers, scheduling, score verification, withdrawals, cancellations, and
  when tournament results enter normal ratings.

### Done when

- The brand has exact assets and tokens rather than visual approximations.
- Every route has an owner, purpose, primary action, and required data source.
- Tournament implementation has an accepted product decision and acceptance criteria.
- No unresolved UI decision can force a global redesign after Segment 1.

---

## 5. Segment 1 - brand foundation and design system

**Goal:** create the reusable visual language that every later screen consumes.

### Foundation

- Replace the current ad hoc color variables with semantic tokens for canvas, surface,
  raised surface, text, muted text, border, brand navy, brand basil, accent, positive,
  warning, critical, focus, and disabled states.
- Establish typography roles for display, page title, section title, body, label,
  numeric score, metadata, and monospaced invite codes.
- Define consistent spacing, radii, borders, shadows, focus rings, content widths, and
  responsive breakpoints.
- Add the approved Struck mark and Tenny lockups as reusable image components with
  correct variants, intrinsic dimensions, alternative text rules, and small-size use.
- Update metadata, manifest name, theme colors, app icons, favicon, and browser/PWA
  presentation to Tenny.

### Shared UI primitives

- Buttons: primary, secondary, quiet, critical, icon, loading, and disabled.
- Form controls: text, email, password, date, select/combobox, score input, checkbox,
  radio, segmented choice, field hint, and field error.
- Structure: page header, section header, card, inset panel, divider, responsive stack,
  data table/list, tabs, and stat tile.
- Feedback: inline alert, banner, toast, skeleton, spinner, progress indicator, empty
  state, error state, and offline state.
- Overlays: menu, dialog, confirmation dialog, and mobile bottom sheet. Focus trapping,
  escape behavior, scroll locking, and focus restoration are required.
- Identity and status: initials avatar fallback, role badge, match status badge, rating
  delta, group badge, and tournament status badge.

### Domain primitives

- `Scoreline`: player names and up to three set scores, including tiebreak notation.
- `MatchCard`: compact and expanded variants using the same score model.
- `PlayerSummary`: identity, rating, record, and recent form.
- `StandingRow`: rank, movement, player, rating, record, and inactive state.
- `GroupCard`: role, member count, recent activity, and next action.
- `TournamentCard`: format, field size, current round/status, dates, and viewer role.
- `BracketMatch`: round slot, participants, score/status, winner, and pending action.

### Done when

- A single internal showcase route or component test suite renders every variant and
  interaction state without introducing a production navigation destination.
- Tokens and primitives work at 320px, 768px, and wide desktop layouts.
- Keyboard, screen-reader, reduced-motion, contrast, and 200% zoom checks pass.
- Later segments do not need one-off button, card, badge, dialog, or form styles.

---

## 6. Segment 2 - public site, auth, and system pages

**Goal:** make the first-run experience unmistakably Tenny and visually connected to
the signed-in product.

### Public landing page

- Rebuild the landing page around the Tenny wordmark and Struck motion concept.
- Keep the value proposition concrete: verified scores, fair standings, and a clearer
  next match.
- Show a realistic match score card using the production component, not a separate
  marketing-only imitation.
- Add clear sign-in and create-account actions, a short three-step verification story,
  group/standings context, and an installable-PWA explanation.
- Redirect authenticated visitors from `/` to `/dashboard`.

### Account experience

- Apply the brand shell to sign in, signup, password reset, password update, callback,
  and confirmation states.
- Preserve the current privacy behavior for invalid credentials and password reset.
- Add password visibility controls, clear pending states, autofill-safe labels, and
  actionable success/error copy.
- Make callback processing, expired links, and recovery failures understandable rather
  than exposing a blank or generic system page.

### System pages

- Brand `not-found`, unexpected error, route loading, and offline experiences.
- Provide safe recovery actions: retry, return to dashboard, or sign in as appropriate.

### Done when

- A new user can move from landing page to confirmed account to dashboard without an
  unbranded or ambiguous screen.
- Auth forms remain fully keyboard and password-manager usable.
- Desktop and mobile Playwright flows cover sign in, signup validation, reset request,
  sign out, unauthenticated redirects, and common callback failures.

---

## 7. Segment 3 - authenticated application shell

**Goal:** establish the navigation and layout all signed-in routes share.

### Work

- Add a protected route group with one responsive shell.
- Implement the compact bottom navigation, wide left rail, top app header, current-route
  state, profile menu, group context/switcher, and sign-out entry point.
- Use the full Tenny lockup where space allows and the approved mark at compact sizes.
- Add shared page width, gutters, safe-area padding, sticky navigation behavior, and
  scroll restoration.
- Give every route a consistent title region, optional context/breadcrumb, primary
  action area, and document title.
- Add route-level loading skeletons that match final geometry and avoid layout shifts.
- Keep authorization in the data layer; hiding a navigation item is not a security
  boundary.

### Done when

- Every existing authenticated route renders inside the shell.
- Navigation works with keyboard, pointer, touch, screen reader, deep links, refresh,
  and installed standalone mode.
- The current route and selected group are always clear without relying on color alone.
- Shell layout has no horizontal overflow at 320px and no excessively stretched content
  on wide desktop displays.

---

## 8. Segment 4 - groups and member management

**Goal:** bring the already-working group behavior into the finished app experience.

### Group index

- Replace the stacked utility forms with group cards and clear Create group / Join group
  actions.
- Move creation and invite-code entry into focused dialogs or mobile sheets.
- Cover first group, invalid/expired invite, restored membership, and multiple-group
  states.

### Group detail

- Add an overview header with group role, member count, invite action, and relevant
  organizer controls.
- Organize content into Overview, Standings, Matches, and Members tabs or equivalent
  small-screen sections with shareable URLs where state matters.
- Show a standings preview, recent match cards, active roster, and empty-state prompts.
- Preserve departed members in historical standings while distinguishing them from the
  active roster.

### Group settings

- Separate routine actions from destructive/member-management actions.
- Show invite code, expiration, copy/share feedback, and rotation confirmation.
- Add clear promote, demote, remove, restore, transfer-organizer, and leave flows.
- Explain irreversible consequences before submission and surface database errors in
  player language.

### Done when

- Existing group capability remains intact with no direct raw database errors.
- A player and an organizer each see only valid actions for their role.
- Mobile and desktop E2E coverage exercises create, join, switch, invite rotation,
  member role change, remove/restore, transfer, and leave guardrails.

---

## 9. Segment 5 - matches and the score-card system

**Goal:** ship the primary product loop: submit, verify, and understand a result.

### Required data work

This segment includes or follows the match migration, RLS policies, policy tests,
`submit_match()` RPC, mutation actions, and typed match queries described by the current
product decisions. UI completion cannot be declared against fixtures alone.

### Match card specification

Every match card uses one data model and supports:

- compact dashboard/list and expanded history variants;
- completed, retired, and walkover outcomes;
- pending confirmation, confirmed, rejected, expired, and voided states;
- two or three sets, optional tiebreak points, and winner emphasis;
- group, played date, submitted/confirmed context, and rating delta when available;
- contextual action for confirm, reject, edit, withdraw, view, or organizer void;
- inactive/former-player presentation without erasing historical identity.

### Match list

- Build `/matches` with Pending your action, Awaiting opponent, and History sections.
- Add status, group, player, and date filters with a clear reset.
- Keep filter state in the URL when it affects a shareable view.
- Use pagination or an explicit load-more pattern before match history becomes large;
  do not ship an unbounded client list.

### Score submission

- Build a guided mobile-first flow: group, opponent, date, outcome, sets, review, submit.
- Default the date to today while allowing a past date.
- Add/remove the third set based on valid match state rather than presenting all fields
  as one dense form.
- Reveal tiebreak points only for a 7-6 set.
- Support completed, retirement with partial score, and scoreless walkover paths.
- Validate as the user proceeds, retain entered values after recoverable server errors,
  and let the database remain the final legality authority.
- Show a plain-language review screen explaining that the opponent must confirm and the
  match becomes immutable after confirmation.

### Match detail and verification

- Show the complete score, status timeline, submitter, dates, group, and rating impact.
- Give the opponent clear Confirm score and Reject score actions with confirmation.
- Let the submitter edit or withdraw only while pending.
- Mark a pending item older than 14 days as expired without implying a scheduled job.
- Give organizers a reasoned void flow; never offer score editing on confirmed matches.

### Done when

- A score can be submitted, corrected while pending, confirmed/rejected by the opponent,
  withdrawn by the submitter, and voided by an organizer where allowed.
- No UI path allows the submitter to confirm their own match or mutate a confirmed score.
- Unit tests cover all score/outcome/status render variants and score-entry transitions.
- Mobile Playwright covers submission through confirmation and the resulting history
  update with two test accounts.

---

## 10. Segment 6 - standings and ratings

**Goal:** make the consequence of every confirmed match easy to understand.

### Required data work

- Implement the derived rating fold over confirmed, non-void matches ordered by
  `confirmed_at`, never `played_on`.
- Keep the starting rating `1500`, `K = 32`, and `MOV_M = 0.25` named in one database
  implementation.
- Return global rating, group-filtered rating, record, position, movement where defined,
  and rating history without introducing a stored `rating` column.

### Standings experience

- Build `/standings` with Global and group-scoped views.
- Create a compact mobile ranking list and a richer desktop table from the same data.
- Show rank, player, rating, wins/losses, matches played, recent form, and inactive state.
- Define deterministic tie presentation; do not imply a unique rank when the underlying
  rule considers players tied.
- Add search for larger groups and a direct path to the player's profile.
- Explain ratings in concise product language, including why match date and rating order
  can differ.

### Rating history

- Add current rating, personal best when derivable, total change, and chronological
  history to profile and match detail.
- Prefer an accessible list/table as the source of truth. A chart may enhance it but
  cannot be the only way to read the values.
- Show skipped walkovers, rated retirements, and voided results accurately.

### Done when

- Confirming a match changes the affected standings and its cards/details show the same
  rating delta.
- Backdating a newly confirmed match does not alter any earlier rating-history entry.
- Empty, first-match, tied, inactive-player, walkover, retirement, and voided states are
  covered by tests.
- Mobile and desktop E2E verify a standings move after confirmation.

---

## 11. Segment 7 - dashboard

**Goal:** make `/dashboard` the fastest route to what the player needs next.

### Layout and priority

1. Required action: pending score confirmations, rejected submissions needing review,
   or expiring items.
2. Primary action: log a match.
3. Rating summary: global rating, recent change, and relevant group position.
4. Recent results: the latest match cards with direct detail links.
5. Group pulse: selected group standings preview and member/activity summary.
6. Tournament pulse: active event and next tournament match when tournament data exists.

### Behavior

- Personalize greeting and context without wasting the first viewport on decoration.
- Let multi-group users change context without navigating away.
- Collapse absent sections cleanly rather than filling the page with empty cards.
- Provide first-run guidance for a user with no group and group-level guidance when no
  match exists yet.
- Keep the log-match action reachable at thumb distance on compact screens without
  covering content or bottom navigation.

### Done when

- The dashboard never shows fabricated activity.
- Each actionable item leads directly to the matching completion flow.
- First account, first group, pending action, active player, and no-tournament states all
  have intentional layouts.
- The dashboard's critical information fits in a clear hierarchy at 320px, tablet, and
  wide desktop widths.

---

## 12. Segment 8 - profile and account settings

**Goal:** give every player a useful identity and a safe place to manage their account.

### Public-within-the-app player profile

- Display initials fallback, display name, active groups, current global rating, record,
  recent form, and match history.
- Allow group members to navigate from standings, rosters, and match cards to a player
  profile containing only data they are authorized to see.
- Keep generated/uploaded avatars out of this milestone; generated avatars remain
  deferred in the product decisions.

### Own profile

- Add display-name editing with validation, pending state, success feedback, and stale
  session/data reconciliation.
- Add personal rating history, group memberships, and filters for the player's match
  history.
- Make empty states useful for a new player without inventing performance statistics.

### Settings

- Separate Profile, Account & security, and Session actions.
- Link into the existing password-reset/update flow rather than collecting passwords in
  an unrelated profile form.
- Add clear sign-out and account-deletion information. Account deletion itself must not
  ship until its confirmation, reauthentication, cascade consequences, and support path
  are explicitly designed.

### Done when

- A player can update their display name and see the change across the shell, standings,
  groups, and match cards after server confirmation.
- Another authorized group member can open the player's permitted profile without seeing
  account-private fields such as email.
- Profile and settings pass privacy, authorization, empty-state, keyboard, and mobile
  interaction tests.

---

## 13. Segment 9 - tournaments

**Goal:** add a real tournament experience without guessing at competition rules.

This segment begins only after Segment 0 produces an accepted tournament decision. The
recommended first release is **single-elimination, singles, group-scoped**, reusing the
normal verified match and score-card model. Round-robin and pool play remain later
formats unless the product decision explicitly changes.

### Tournament list and creation

- Split events into Needs your action, Active, Upcoming, and Completed.
- Show format, group, dates, entrant count/cap, status, organizer, and viewer state.
- Build a step-based organizer flow for details, eligibility/group, entrant cap,
  registration window, seeding method, schedule expectations, review, and publish.
- Do not advertise registration, bracket generation, or score behavior the backend does
  not enforce.

### Tournament detail

- Overview: status, key dates, organizer, entrant count, rules summary, and viewer CTA.
- Entrants: registered/seeded status, withdrawal state, and waitlist only if approved.
- Draw: horizontally scrollable bracket on compact screens with a round selector and a
  full bracket on wide screens; preserve an accessible round-by-round list.
- Schedule/results: chronological match cards linked to normal match detail.
- Completed state: champion, final result, and tournament summary without inventing
  unsupported awards or statistics.

### Organizer management

- Registration open/close, entrant approval if required, seeding, draw generation,
  schedule assignment, withdrawals, match dispute/void escalation, and tournament
  cancellation according to the accepted contract.
- Require confirmation for actions that change the draw or tournament status.
- Record and display consequential organizer actions; do not hide them in transient
  toasts only.

### Integration rules

- A tournament result uses the same score validation, opponent confirmation, immutable
  confirmed match, organizer voiding, and derived rating behavior as an ordinary match
  unless the tournament decision explicitly overrides it.
- Do not create a visually separate score system for tournaments.
- Tournament permissions must be enforced by RLS/RPCs, not by organizer-only controls
  being hidden in the browser.

### Done when

- Organizer and player journeys are defined end to end for create, register, seed,
  publish draw, submit/verify result, advance winner, withdraw, cancel, and complete.
- Byes, odd entrant counts, rejected scores, withdrawals, voided results, and event
  cancellation have explicit UI and tested backend behavior.
- Bracket information is fully usable by keyboard and screen reader and remains legible
  at 320px without shrinking text below the design-system minimum.
- Mobile and desktop E2E cover one complete small tournament from creation to champion.

---

## 14. Segment 10 - cross-product polish and release hardening

**Goal:** make the entire frontend feel like one dependable product.

### State and copy audit

- Verify loading, empty, error, offline, permission-denied, not-found, destructive,
  success, and partial-data states for every route.
- Normalize terminology: Tenny, group, organizer, player, match, result, standings,
  rating, and tournament.
- Remove placeholder copy, temporary comments exposed through UI, dead links, fake
  scores, and implementation language from player-facing messages.

### Responsive and accessibility audit

- Test 320px phone, modern phone, tablet portrait/landscape, laptop, and wide desktop.
- Test browser zoom to 200%, text scaling, keyboard-only navigation, screen reader
  landmarks/names, reduced motion, high contrast where supported, and landscape safe
  areas in installed mode.
- Ensure sticky headers, sheets, dialogs, score rows, tables, brackets, and bottom
  navigation do not overlap or trap content.

### Performance and resilience

- Set page-level performance budgets after measuring the completed representative routes.
- Keep large data work on the server, stream useful route sections where appropriate,
  and avoid sending private rows to the client merely to filter them there.
- Optimize logo/image assets, font loading, and layout stability.
- Make recoverable mutations retryable without duplicate match or tournament creation.
- Add route-level error boundaries around independent dashboard and detail sections when
  partial rendering is safer than losing the entire page.

### PWA and device QA

- Verify install, launch, theme color, icon mask/safe area, standalone navigation,
  authentication persistence, deep links, and update behavior on real iOS and Android
  devices.
- Verify the explicit online-required state after launch and after connectivity loss.
- Do not add authenticated offline caching or queued writes.

### Test matrix

- Component tests for every shared primitive and domain-card state.
- Server/action tests for validation, authorization, and friendly error mapping.
- Playwright desktop and mobile projects for the critical user journeys.
- Database policy tests in the same pull request as every new user-data table or RPC.
- Manual visual comparison against the brand source at each breakpoint before review.
- Full local gate: `format:check`, `lint`, `typecheck`, `test`, `build`, `test:e2e`, and
  database tests when schema or policies change.

### Done when

- No production route is a placeholder or relies on permanent fixtures.
- All critical journeys work in both mobile and desktop Playwright projects.
- There are no known critical/serious accessibility violations or keyboard blockers.
- Real-device installed-PWA checks pass on iOS and Android.
- Error reporting, backup/restore, deploy rollback, and environment separation are ready
  before anyone outside the pilot is invited.

---

## 15. Delivery sequence

```text
Segment 0  UI + tournament contract
    |
Segment 1  Brand foundation and design system
    |
    +--> Segment 2  Public site, auth, and system pages
    |
Segment 3  Authenticated application shell
    |
Segment 4  Groups and member management
    |
Segment 5  Matches and score cards
    |
Segment 6  Standings and ratings
    |
    +--> Segment 7  Dashboard composition
    +--> Segment 8  Profile and settings
    |
Segment 9  Tournaments
    |
Segment 10 Cross-product polish and release hardening
```

Segments 2 and the non-shell parts of Segment 3 may proceed in parallel after the
design system is stable. Segments 7 and 8 may proceed in parallel after the match and
rating contracts stabilize. Tournament visual primitives may be explored earlier, but
the production routes wait for the tournament product and data contract.

The current execution edge is **Segment 1**. Segment 0 is recorded in
[`docs/design/ui-direction.md`](docs/design/ui-direction.md): brand assets, tokens,
type, shape, and navigation are locked, and three decisions stay open there (the
tournament contract, typeface confirmation, and official reversed lockups). Segment 1
has its foundation in place: tokens, type roles, brand image components, and Tenny
metadata and icons. The shared UI primitives, domain primitives, and showcase are
next. Do not start by styling the dashboard in isolation.

---

## 16. Standing engineering rules

- Check the relevant guide in `node_modules/next/dist/docs/` before using a remembered
  Next.js API. This repository's Next.js version has breaking convention changes.
- Keep pages focused on composition. Put reusable visual primitives and domain
  components in focused component modules, and keep server data access out of client
  components unless interactivity truly requires it.
- Default to Server Components; add `"use client"` at the smallest interactive boundary.
- Keep authorization and validation on the server/database even when the UI prevents an
  invalid action.
- Every user-data table ships with RLS policies and policy tests in the same pull request.
- Ratings are derived. Adding a stored `rating` column requires a new decision record.
- A confirmed score is immutable. Correction means organizer voiding, never editing.
- Rating order is `confirmed_at`, never `played_on`.
- No seeded or destructive E2E tests run against a Supabase project shared with preview
  or production data.
- Service-role keys and database passwords never carry a `NEXT_PUBLIC_` prefix.
- Preserve user input after recoverable form failures and prevent duplicate submissions.
- Treat mobile layout, accessibility, empty/error states, and tests as part of each
  segment, not a cleanup phase deferred to Segment 10.
- Do not add doubles, social login, push notifications, generated avatars, authenticated
  offline caching, round-robin, or pool play without their own approved scope.
