# Product decisions

These questions were resolved on 2026-09-06, before feature development began. The
reasoning behind the rating and immutability decisions lives in
[`decisions/0002-match-immutability-and-derived-ratings.md`](decisions/0002-match-immutability-and-derived-ratings.md).

## Match scoring

- Best-of-three **full sets**. All three sets end at 6-6 with a tiebreak. Legal set
  scores are 6-0 through 6-4, 7-5, and 7-6. No advantage sets.
- Tiebreak points are an optional extra field on a 7-6 set.
- Outcomes are `completed`, `retired`, or `walkover`. A retirement keeps its partial
  score; a walkover has no score.
- Date played is a date, not a timestamp. It defaults to today, may be set to a past
  date at submission, and affects display and sorting only.
- A match counts only once both players agree on the score. **A confirmed match is
  immutable** — never updated, deleted, or redated.
- While pending, the submitter may edit or withdraw their own submission. The opponent
  may confirm or reject.
- A pending match older than 14 days is treated as expired. This is computed from
  `created_at`; there is no scheduled job.
- An organizer may void a confirmed match. The score is never rewritten — the row is
  marked void and drops out of the rating fold.

## Rankings

- Ratings are derived from confirmed matches, never stored.
- The fold orders by **confirmation time, not date played**, which is what keeps it
  append-only. See ADR 0002.
- Both a global rating across all groups and per-group standings. One function,
  parameterized by an optional group filter.
- Starting rating 1500, flat `K = 32`.
- Margin of victory via bounded linear game share:
  `multiplier = 1 + 0.25 × (share − 0.5) × 2`, ranging 1.0× to 1.25×.
- Walkovers are skipped by the fold. Retirements rate on the games actually played.

## Groups and access

- A user may belong to multiple groups.
- Joining uses a reusable invite code with an expiry date, default 30 days. The organizer
  regenerates the code to revoke or extend it. Expiry blocks new joins only; existing
  members are unaffected.
- A member who leaves or is removed stays in standings, marked inactive, and drops off
  the active roster. Their matches are untouched.
- A group always has at least one organizer. Organizers may promote others; the last
  organizer cannot leave without transferring the role.
- Account deletion hard-deletes the user's matches. This shifts former opponents'
  ratings and is the one place history is not immutable — accepted deliberately, with a
  revisit trigger recorded in ADR 0002.
- Row Level Security policies ship with policy tests in the same pull request as the
  table they protect.

## Authentication

- Email and password, with email confirmation on signup and a display name captured at
  signup.
- Magic links were rejected: tapping one in a mail client opens the default browser
  rather than the installed PWA, leaving the user signed in somewhere other than the app
  on their home screen.

## Environments

- One Supabase project serves previews and production for now. This is a deliberate,
  time-limited tradeoff with a revisit trigger in ADR 0002. While it stands, no seeded or
  destructive end-to-end tests run against the shared project.

## Still deferred

Naming and trademark clearance, doubles, offline match submission, push notifications,
generated avatars, round-robin or pool-play tournaments, and social login. None enter the
first pilot without a separate design and acceptance criteria.
