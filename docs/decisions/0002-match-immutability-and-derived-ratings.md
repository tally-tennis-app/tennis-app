# Decision 0002: Match immutability and derived ratings

- **Status:** Accepted
- **Date:** 2026-09-06
- **Supersedes the open questions in:** [`docs/product-questions.md`](../product-questions.md)

## Context

Ratings are the product's core promise, and the most expensive thing to get wrong. The
open question was what happens to rating history when a match is corrected or backdated:
replay every subsequent rating, or apply a present-day adjustment. Replay means ratings
cannot be a mutable column; adjustment means history becomes permanently wrong after the
first correction.

## Decision

**A confirmed match is immutable.** Both players must agree on a score before it counts.
Once confirmed it is never updated, deleted, or redated.

This removes the question rather than answering it. History cannot be corrected, so
there is nothing to replay.

Three things follow directly:

### Ratings are derived, never stored

A SQL function folds confirmed, non-void matches. There is no `rating` column, no
recompute job, and no cache to invalidate. Promote to a stored table only when a
measurement shows the fold is too slow — at pilot volume it is milliseconds.

### The fold orders by confirmation time, not date played

A player may enter the date a match was played, including a past date. If the fold
ordered by that date, logging last Tuesday's match today would insert it into the middle
of history and change every rating after it — reintroducing exactly the replay problem
this decision eliminates.

Ordering by `confirmed_at` keeps the fold strictly append-only. Date played is display
and sorting only.

**This is the load-bearing detail of the whole model.** It gets a dedicated regression
test: submit a backdated match, confirm it, assert no prior rating moved.

### Voiding replaces correcting

A score is never rewritten. An organizer may mark a confirmed match void, and voided
matches drop out of the fold. Because ratings are derived, everything after a voided
match recomputes correctly for free.

Without derived ratings this escape hatch would not be affordable — which is the second
reason for D9, beyond avoiding a cache.

## Rating formula

```
expected_a = 1 / (1 + 10^((rating_b − rating_a) / 400))
share      = winner_games / total_games
multiplier = 1 + MOV_M × (share − 0.5) × 2
delta      = K × multiplier × (actual − expected)
```

Starting rating 1500, `K = 32`, `MOV_M = 0.25`. The multiplier ranges from 1.0× for a
7-6 7-6 grind to 1.25× for a 6-0 6-0.

`K` and `MOV_M` are named constants in one place. They are calibration knobs, not
settled values — a rating formula cannot be tuned without real results to tune it
against, and the pilot is how those are obtained.

Walkovers are skipped by the fold entirely; no tennis was played. Retirements rate
normally on the games actually played.

## Accepted tradeoffs

Two decisions carry a known cost and were taken deliberately.

### Account deletion hard-deletes matches

Deleting an account cascades to that player's matches, which shifts every former
opponent's rating. This is the one place history is not immutable.

Accepted because deletion is a near-zero event in a pilot of friends, and anonymization
machinery is real work for a case that may never occur.

**Revisit when:** deletions happen more than once, or the product opens beyond the pilot
group. The mitigation is to anonymize — delete the person, keep the matches attached to
a "Former player" placeholder.

### One Supabase project for previews and production

Preview deploys write to the same database that holds pilot user data.

**Mitigation while this stands:** no seeded or destructive end-to-end tests against the
shared project.

**Revisit when:** real user data matters more than setup cost — which is before anyone
outside the pilot group is onboarded, at the latest.

## Consequences

- No `rating` column exists anywhere. A pull request adding one needs a new decision record.
- Matches carry `voided_at` / `voided_by`, never an edited score.
- The rating function is the single place `K` and `MOV_M` appear.
- Ordering the fold by `played_on` instead of `confirmed_at` is a silent correctness bug,
  not a preference. The regression test exists to catch it.
