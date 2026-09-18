# Decision 0003: First tournament format

- **Status:** Proposed. Segment 9 does not start until this is accepted.
- **Date:** 2026-09-18

## Context

The roadmap adds tournaments after matches and ratings. Round-robin and pool play
are explicitly deferred in `docs/product-questions.md`, and no tournament rules
exist yet. Building screens before the rules would mean guessing at behaviour the
database must enforce.

## Proposal

**Single elimination, singles, inside one group**, built on the existing verified
match model.

| Question         | Proposed answer                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligibility      | Active members of the tournament's group.                                                                                                                                 |
| Entrant cap      | 4, 8, 16, or 32, set at creation. A field below the cap is padded with byes.                                                                                              |
| Registration     | Players register themselves while registration is open. No waitlist and no organizer approval in v1.                                                                      |
| Seeding          | Organizer chooses at draw time: by current group rating (default), or random.                                                                                             |
| Byes             | Go to the top seeds. A bye advances the player without creating a match.                                                                                                  |
| Draw             | Generated once when the organizer closes registration. After that the draw is fixed.                                                                                      |
| Scheduling       | A round deadline date per round, set by the organizer. No court or time booking.                                                                                          |
| Results          | Each tournament match is a normal match: submitted by either player, confirmed by the opponent, immutable once confirmed. The confirmed winner advances automatically.    |
| Disputes         | A rejected result goes back to the submitter, as today. The organizer may void a confirmed tournament match; the tie then needs a new result before the round can finish. |
| Withdrawals      | A player may withdraw before their next match. Their opponent advances by walkover, which is not rated.                                                                   |
| Missed deadline  | The organizer records a walkover for the player who showed up, or, if both fail to play, eliminates both and gives their next-round opponent a bye.                       |
| Cancellation     | The organizer may cancel at any point. Confirmed matches stay confirmed and keep counting toward ratings.                                                                 |
| Ratings          | Tournament matches enter the normal fold like any other confirmed match. No tournament bonus.                                                                             |
| Organizer powers | Create, open or close registration, seed, set deadlines, record walkovers, void, cancel. All enforced in database functions and logged with actor and time.               |
| Completion       | The tournament completes when the final is confirmed. The winner is recorded as champion; no other awards.                                                                |

## Consequences

- New tables `tournaments`, `tournament_entrants`, `tournament_ties`, with RLS and
  policy tests in the same pull request, and a nullable `matches.tournament_tie_id`.
- Advancement happens in `confirm_match()`, never in the browser.
- The bracket UI reuses `MatchCard` and `Scoreline`; there is no separate
  tournament score system.
- Round-robin, pool play, doubles, and consolation draws stay deferred.

## Open questions for the product owner

1. Is a 32-player cap needed for the pilot, or is 16 enough?
2. Should an organizer be able to enter results on behalf of players who do not
   use the app? The proposal says no, to keep every result player-verified.
3. Should registration require organizer approval? The proposal says no.
