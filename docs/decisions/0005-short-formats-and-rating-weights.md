# Decision 0005: Short formats and rating weights

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The pilot group plays more than best-of-three matches. A single set and a
standalone tiebreak are how most casual meetings actually end, and until now
neither could be recorded at all: `validate_match_score` required two or three
sets for a completed result, so a real result had nowhere to go.

Recording them raises a rating question immediately. A tiebreak is a far weaker
signal of who is the better player than three sets, and treating the two alike
would let a run of tiebreaks move a rating as much as a run of matches.

## Decision

`matches.format` is `match`, `set`, or `tiebreak`, and the derived fold weights
`K` by format:

| Format     | Weight | Movement at equal ratings, biggest margin |
| ---------- | ------ | ----------------------------------------- |
| `match`    | 1.0    | 20 points                                 |
| `set`      | 0.5    | 10 points                                 |
| `tiebreak` | 0.25   | 5 points                                  |

A set is worth half a match and a tiebreak half a set. The weight is a named
function, `private.format_weight`, beside the existing `K` and `MOV_M`
constants — these are calibration knobs and will need tuning against real pilot
results, so they stay in one place.

### Why the weight and not a separate rating

Ratings remain a single derived fold over confirmed matches (ADR 0002). One
rating per player, one ladder, with short formats contributing less to it. The
alternative, a separate rating per format, splits a pilot group's already thin
match history three ways and gives nobody a meaningful number.

### Margin of victory on a tiebreak

A standalone tiebreak records no games, so the existing games-share margin would
read as a neutral 1.0× for every tiebreak. The fold therefore takes a tiebreak's
margin from its points instead: 10-0 earns the full 1.25×, 10-8 about 1.03×. The
clamp is unchanged.

### How a tiebreak is stored

A standalone tiebreak is one `match_sets` row with no games, both players'
points in the existing tiebreak columns, and a `tiebreak_target` of 7 or 10. The
non-null target is what distinguishes it from an ordinary set, which lets the
per-row CHECK stay exact without reading the parent match, and leaves every
existing row and every games-based rule untouched.

Consequence: a tiebreak contributes no games to `group_standings`, exactly like
a walkover. Its wins and losses still count.

### Tournaments

An organizer chooses one format when creating a tournament, and every tie in the
draw uses it. A tie's submitter cannot override it; the format comes from the
tournament row, not from the form.

## Rejected matches are hidden, not deleted

A rejection stops being visible five days after `rejected_at`, computed at read
time in the match select policies. The row stays in the database.

This follows the fourteen-day pending rule: a computed expiry with no scheduled
job to own, no `pg_cron` dependency, and one predicate that the list, the detail
page, the standings view, and every future reader inherit. Deleting would need a
cron job to gain nothing a filter does not already give, since a rejection never
counted toward a rating in the first place.

Accepted cost: after five days the submitter can no longer read the rejection
reason. They are expected to log the corrected score well before then.

## Revisit triggers

- **The weights are wrong.** If pilot players find that tiebreaks barely move
  anything, or that single sets dominate the ladder, change the two numbers in
  `private.format_weight` and note the measurement here. No migration of stored
  data is needed, because nothing is stored.
- **Formats need separate ladders.** If the group's play splits so that the
  combined rating stops describing anyone, revisit the single-fold decision with
  a new record rather than by adding a column.
- **Five days is too short.** If submitters routinely lose a rejection reason
  they still needed, raise the window in `match_is_visible`.

## References

- [ADR 0002](0002-match-immutability-and-derived-ratings.md) — the derived fold
  this weights.
- [ADR 0004](0004-tournaments-v1.md) — the tournament scope a format now applies
  to.
- `supabase/migrations/20260923120000_match_formats.sql`
- `supabase/migrations/20260923120100_rejected_match_expiry.sql`
