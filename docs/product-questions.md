# Product decisions before feature development

These questions are intentionally outside the foundation. Resolve the relevant section before implementing that subsystem.

## Name and positioning

- Complete trademark, app-store, domain, and competitive searches before adopting “Tally Tennis” as the customer-facing name.
- Decide whether public repository discussions may use unreleased product and campaign details.

## Match scoring

- Define valid set scores and best-of-three behavior.
- Decide how to represent set tiebreaks, match tiebreaks, retirements, walkovers, abandoned matches, and incomplete scores.
- Specify the edit/dispute window, organizer override, and audit history.

## Rankings

- Specify the global Elo formula, score-margin adjustment, initial rating, rounding, and tie behavior.
- Decide whether corrected or backdated matches replay subsequent rating history or apply a present-day adjustment.
- Decide which global rating and profile details are visible across otherwise unrelated groups.

## Groups and access

- Define invite expiration, code rotation, membership removal, organizer transfer, and account deletion.
- Design and test Row Level Security policies before storing group or match data.

## Deferred capabilities

Doubles, offline match submission, push notifications, generated avatars, and round-robin or pool-play tournaments remain out of the first pilot unless they receive separate designs and acceptance criteria.
