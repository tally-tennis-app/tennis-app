# Short formats, rejected-match expiry, and richer profiles

Five product changes, delivered in three steps, without taking production down.

1. Tiebreak matches — a standalone tiebreak to 7 or 10 points is a whole result.
2. Single-set matches — one set is a whole result.
3. Rating weight — a set counts half a match, a tiebreak half a set.
4. A rejected match disappears after five days.
5. The profile screen gains an avatar, a hometown, and a bio.

## Why this needs a plan rather than a patch

None of it is currently expressible. `matches` has no format concept, so
`validate_match_score` demands two or three sets for a `completed` result. The
rating fold applies a flat `K = 32` to every match. `reject_match` writes no
timestamp, so there is nothing to age out. `profiles` is exactly `id`,
`display_name`, `created_at`, and the project has no Storage bucket at all.

Production also deploys differently from the schema. Merging to `main`
auto-deploys the application through Vercel, but migrations are a deliberate
operator `supabase db push` ([`docs/operations/environments.md`](docs/operations/environments.md)).
A Vercel rollback therefore reverts code and leaves the schema forward, which is
why every migration below is additive with a default and stays compatible with
the application already running.

## Step 1 — Database

Three independent migrations, each with its own pgTAP file. Every write already
goes through a `SECURITY DEFINER` RPC and the tables have no mutation policies,
so the RPC layer remains the only write boundary.

### 1a. Match formats

`matches.format` is `text not null default 'match'` constrained to `match`,
`set`, or `tiebreak`. The default is what keeps the deployed application working:
it never sends a format, and keeps producing best-of-three rows.

A standalone tiebreak is stored as one `match_sets` row with `games_a = games_b =
0`, the points in the existing `tiebreak_a` and `tiebreak_b`, and a new
`match_sets.tiebreak_target` of 7 or 10. A non-null target is what marks the row
as a standalone tiebreak, which lets the per-row CHECK stay exact without seeing
the parent match. The `match_sets_legal_score` constraint moves to a new
`is_legal_score_row(...)` that delegates to the existing `is_legal_match_set(...)`
whenever the target is null, so every existing row and every games-based rule
keeps its current behaviour. `set_number between 1 and 3` needs no change: a
single set and a tiebreak are both set number 1.

`validate_match_score` gains a `match_format` parameter and enforces the shape
per format.

| Format     | Walkover | Completed                                        | Retired                       |
| ---------- | -------- | ------------------------------------------------ | ----------------------------- |
| `match`    | no sets  | 2–3 sets, winner took 2                          | 1–3 sets, last may be partial |
| `set`      | no sets  | one complete set, its winner wins the match      | one partial set               |
| `tiebreak` | no sets  | one complete tiebreak, its winner wins the match | one undecided tiebreak        |

RPCs widen by overload, never by adding a defaulted parameter: PostgREST
resolves by named-argument set, so a default would make the existing
seven-argument call ambiguous. This follows the `reject_match(uuid)` and
`reject_match(uuid, text)` pair already in the schema. `submit_match` and
`edit_match` each gain an eight-argument form that does the real work, with the
old form delegating and passing `'match'`. `submit_tournament_match` keeps its
signature and reads the format from its tournament.

Tournaments choose a format at creation: `tournaments.format` with the same
default, a `create_tournament` overload, and every tie in the draw inheriting it.

Rating weight is one new `private.format_weight(text)` returning 1.0, 0.5, or
0.25, and one changed line in the fold:

```sql
change := parameters.k * private.format_weight(m.format) * multiplier * (...)
```

Margin of victory for a tiebreak comes from points rather than games, because a
tiebreak row records no games and would otherwise collapse to a neutral
multiplier. The existing 1.0–1.25 clamp is unchanged.

### 1b. Rejected-match expiry

`matches.rejected_at` is added and backfilled from `created_at` for existing
rejected rows, `reject_match` starts setting it, and one immutable
`match_is_visible(status, rejected_at)` helper is used by both the `matches` and
`match_sets` select policies.

The filter lives in Row Level Security so that the list, the detail page, the
standings view, and every future reader inherit it from one place. The rating
fold is unaffected: it runs as definer and already filters to confirmed matches.

Nothing is deleted. After five days the row is simply invisible, which is the
same computed-expiry shape as the existing fourteen-day pending rule and needs no
scheduled job. The accepted consequence is that the submitter can no longer read
the rejection reason after five days.

### 1c. Profile details

`profiles` gains `hometown` (60 characters), `bio` (280 characters), and
`avatar_path`. The existing own-row update policy already covers writes and the
select policy is already widened to group peers, so no new table policy is
needed.

Avatars go in a new private `avatars` bucket limited to 2 MiB and to JPEG, PNG,
and WebP, with `storage.objects` policies confining a user to their own `<uid>/`
prefix. Other players' avatars are served through a short-lived signed URL minted
on the server, and the existing initials circle stays as the fallback.

## Step 2 — Application

Types are regenerated first with `npm run db:types`; CI diffs the committed file
against a fresh generation.

Score rules live in two places that must agree, because unexpected database
errors are collapsed into a generic message before they reach the user. The
TypeScript mirror in `src/lib/matches/score.ts` takes a format alongside the
outcome, replacing the hard three-set cap and the two-sets-won completion rule
with the table above. `toMatchSets` emits the tiebreak target, and `formatScore`
renders a single set and a tiebreak correctly from either player's side.

`score-form.tsx` already computes its wizard steps from the outcome, and the same
seam carries the format: a choice list in the details step, no third-set reveal
for the short formats, a points entry with a 7 or 10 target in place of the
single-digit games inputs, and a reset of the score drafts whenever the format
changes. On a tournament tie the format is fixed by the tournament and shown as
read-only.

Match cards and the screen-reader sentence label anything that is not a full
match. The tournament creation form gains the format choice.

The profile screen widens its query and renders the hometown under the name with
the bio beneath the header. `Avatar` takes an optional image source and keeps
initials as the fallback. The existing display-name form grows into a profile
form covering all four fields, still writing through the settings server action
so storage policies apply.

Client-side image downscaling is deliberately skipped; the bucket limit and a
96px render cover the pilot.

## Step 3 — Tests, docs, and the production rollout

New and extended pgTAP: format validation cases in `matches_validation`,
hand-computed weight fixtures in `ratings`, a new `rejected_expiry` file
asserting visibility at four days and absence at six, and a new
`profile_details` file covering the length checks, peer reads, and the storage
prefix rule. The TypeScript score tests mirror every new SQL case. The two-account
end-to-end journey gains a single-set and a tiebreak submission and asserts the
smaller rating movement.

Docs: the scoring and deferred-scope sections of
[`docs/product-questions.md`](docs/product-questions.md), a new decision record
for the weights and the hide-rather-delete choice, a `nextsteps.md` segment, and
a correction to the stale shared-Supabase-project bullet in
[`CONTRIBUTING.md`](CONTRIBUTING.md) that ADR 0003 superseded.

Rollout order, which is what keeps production serving:

1. Run the full local gate, then `npm run db:reset`, `npm run db:test`, and the
   seeded local browser journeys.
2. Open the pull request and wait for both CI jobs, including the type-drift
   diff.
3. Push the migrations to preview and run the Supabase security advisors.
4. Deploy preview and smoke test it, including one submission in each format and
   one avatar upload.
5. Re-review the migrations for compatibility with the deployed application, then
   push to production and run advisors again.
6. Merge to `main`, which deploys production, and repeat the smoke test.

## Done when

- A single set and a tiebreak can be submitted, confirmed, and read back with the
  right scoreline and a format label.
- The database by itself rejects two sets submitted as a single set, a 10-7
  tiebreak, and games recorded on a tiebreak row.
- At equal ratings the same result moves a rating 20 points as a match, 10 as a
  set, and 5 as a tiebreak.
- A rejected match is visible on day four and gone on day six, with its sets, for
  both players.
- A profile shows an uploaded avatar, hometown, and bio; a group peer can see
  them, a stranger cannot, and writing outside your own storage prefix fails.
- A tournament created as single-set produces single-set ties.
- Migrations apply from empty, pgTAP passes, the generated types diff is clean,
  desktop and mobile journeys pass, and nothing overflows at 320px.
