# Decision 0004: First tournament format

- **Status:** Accepted. The product owner chose single elimination and delegated the
  fine print below.
- **Date:** 2026-09-18

## Context

The roadmap adds tournaments after matches and ratings. Round-robin and pool play
are explicitly deferred in `docs/product-questions.md`, and no tournament rules
exist yet. Building screens before the rules would mean guessing at behaviour the
database must enforce.

## Decision

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

## Fine print

Settled when the decision was accepted:

1. **Field size.** Caps of 4, 8, 16, or 32 are all allowed. The draw is sized to the
   smallest power of two that fits the entrants actually registered, not the cap, so a
   field of 5 plays an 8-draw with 3 byes rather than a 32-draw with 27. The organizer
   may start with as few as 2 entrants.
2. **Who creates.** Only an organizer of the group creates, starts, or cancels a
   tournament. Any active member may register while registration is open, and may
   unregister until it starts.
3. **Results stay player-verified.** Organizers never enter a score for someone else.
   Their only result powers are a walkover for the player who showed up, and eliminating
   both players of a tie that was never played.
4. **One live result per tie.** A tie accepts one submission at a time. A rejected
   submission is corrected by its submitter, as for any match.
5. **Voiding.** An organizer may void a confirmed tournament match only until the
   winner's next tie has a result submitted. The tie then reopens for a new result and
   the winner leaves the next round. After that point the draw has moved on and the
   result stands; voiding the final reopens the final and clears the champion.
6. **Withdrawal.** A player withdraws themselves, or an organizer withdraws them, at any
   point while they are still in. Their current tie goes to the opponent, or to whoever
   later fills that slot. A pending submission on that tie is removed.
7. **Leaving the group.** A player who leaves the group stays in the draw and can finish
   their tournament. The organizer can withdraw them if they will not play.
8. **Deadlines.** Round _n_ is due _n_ times the round length after the start date.
   Deadlines are guidance; nothing happens automatically when one passes.
9. **Cancellation.** Pending tournament matches become ordinary pending matches in the
   group. Confirmed ones keep counting toward ratings.
