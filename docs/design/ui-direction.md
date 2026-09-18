# Tenny UI direction

The Segment 0 contract from [`nextsteps.md`](../../nextsteps.md). It fixes the brand
assets, tokens, and visual rules every later segment consumes. Change it here first,
then in code.

## Brand assets

All geometry comes from the vector fills in [`Branding.pdf`](../../Branding.pdf),
extracted path for path. Nothing below was redrawn. Every file lives in
[`public/brand/`](../../public/brand) with a 100-unit viewBox height.

| File                           | Source                         | Use                                     |
| ------------------------------ | ------------------------------ | --------------------------------------- |
| `tenny-mark.svg`               | Supplied, full colour          | Mark at 32px and above on light grounds |
| `tenny-mark-reversed.svg`      | Supplied, reversed on navy     | Mark on navy or dark mode               |
| `tenny-mark-on-basil.svg`      | Supplied, on basil             | Mark on a basil ground only             |
| `tenny-mark-one-colour.svg`    | Supplied, one colour flat      | Single-ink reproduction                 |
| `tenny-mark-white.svg`         | Supplied, white                | Photography or near-black grounds       |
| `tenny-lockup-horizontal.svg`  | Supplied                       | Headers where width allows              |
| `tenny-lockup-stacked.svg`     | Supplied                       | Narrow, centred placements              |
| `tenny-ball.svg`               | Supplied, favicon ball         | Large ball-only use                     |
| `tenny-ball-flat.svg`          | Derived: shade paths removed   | Below 32px, per the brand rule          |
| `tenny-app-icon.svg`           | Supplied                       | Source for PWA and Apple icons          |
| `tenny-lockup-*-reversed.svg`  | Derived: reversed-mark palette | Dark mode lockups                       |
| `tenny-ball-flat-reversed.svg` | Derived: reversed-mark palette | Dark mode below 32px                    |

"Derived" files reuse supplied geometry and only swap fills, using the exact
per-path mapping of the supplied reversed mark (trails and wordmark `#f4f1e8`, navy
panel `#ede9dc`, basil panel `#a8c983`, shades `#c6c0ad` and `#87a566`). Ask the brand
owner to confirm or replace them before public launch.

Rendered from these: `app/icon.svg` (flat ball), `app/apple-icon.png` (180px),
`public/icon-192.png` and `public/icon-512.png` (maskable, mark inside the 80% safe
zone).

Use `TennyMark` and `TennyLockup` from `src/components/brand.tsx`. They switch to the
reversed files in dark mode and to the flat ball below 32px. Pass `alt=""` when the
word "Tenny" is already visible or the parent link carries the name.

## Colour

Brand values are exact fills from the PDF. Semantic tokens live in
`app/globals.css`, and `__tests__/tokens.test.ts` asserts their contrast in both
themes.

| Brand       | Hex       |
| ----------- | --------- |
| Navy        | `#14304f` |
| Navy shade  | `#0b2138` |
| Basil       | `#5c8a46` |
| Basil shade | `#466f39` |
| Basil light | `#a8c983` |
| Cream       | `#ede9dc` |
| Paper       | `#f4f1e8` |

Warning, critical, strong borders, and dark-mode muted text have no brand source.
They are derived and marked in the stylesheet.

- Use semantic utilities (`bg-canvas`, `text-ink`, `border-line-strong`,
  `bg-action text-on-action`) in components. Brand utilities are for fixed-ground
  surfaces only, such as the navy error page.
- Basil is not a body-text colour on light grounds (3.6:1). Use `text-accent` or
  `text-positive`, which resolve to basil shade.
- Status is never colour-only. Pair every status colour with a text label or icon.
- Theme follows `prefers-color-scheme`. There is no manual toggle yet.

## Type

The PDF's text is outlined, so no family names are recorded. These are matched by
glyph comparison and must be confirmed by the brand owner:

- **Schibsted Grotesk** for everything, 400 to 900.
- **DM Mono** for labels and invite codes.

The serif editorial type is retired. Roles are utilities in `globals.css`:
`type-display`, `type-title`, `type-section`, `type-body`, `type-label`,
`type-score`, `type-meta`, `type-code`. Scores always use `type-score`, which sets
tabular figures.

## Shape, density, and elevation

- **Corners:** square (radius 0) for surfaces, controls, and buttons, matching the
  brand sheet. Circles are only for identity: avatars and the ball. The app-icon
  radius is applied by the platform.
- **Borders:** 1px `line` for grouping, 1px `line-strong` for control boundaries
  (3:1 minimum).
- **Elevation:** flat by default. `shadow-overlay` is only for menus, dialogs, and
  sheets.
- **Density:** app screens use a daily-app density of 16 to 24px gaps. Touch targets
  are at least 44px.
- **Width:** `max-w-content` (72rem) for app pages and `max-w-prose` (40rem) for
  reading and forms.

## Icons, motion, illustration

- **Icons:** add `@phosphor-icons/react` when the first icon ships. Use one family at a
  single weight, and never hand-draw SVG icons.
- **Motion:** CSS transitions on `transform` and `opacity`, 150 to 250ms,
  `ease-out`. Motion confirms feedback and state changes; it is not decoration.
  Everything collapses under `prefers-reduced-motion`. There is no animation library
  until a segment needs one.
- **Illustration:** none. The Struck mark and the score card carry the brand. Do not
  draw courts, nets, or balls in CSS.

## Routes and navigation

The route inventory in `nextsteps.md` §3 is accepted, plus `/players/[id]` for
another player's profile. Navigation is a bottom bar on compact screens, with profile
and account in the header menu. On `lg` and wider, the same destinations sit in a left
rail with a "Log a match" button.

Until tournaments exist, the four destinations are Home, Matches, Standings, and
Groups; a Tournaments item would be a dead control. When Segment 9 ships, Tournaments
takes a slot and Standings moves to the dashboard, group views, and the header menu.

## Interaction patterns

- **Dialogs and sheets:** native `<dialog>` via `src/components/ui/dialog.tsx`. It
  docks to the bottom edge below `sm`. `ActionDialog` closes only on server success.
- **Menus:** the native Popover API (`popover` / `popovertarget`).
- **Tabs and filters:** links and GET forms, so every view is a shareable URL.
- **Toasts:** none. Results appear inline and are announced through live regions;
  consequential events are recorded on the page they affect.

## Open decisions

These are needed before the segments that depend on them:

1. **Tournament contract (blocks Segment 9).** The recommendation is
   single-elimination, singles, group-scoped, using normal verified matches. It still
   needs eligibility, entrant cap, seeding, byes, organizer powers, scheduling,
   withdrawals, cancellation, and when results enter ratings.
2. **Typeface confirmation.** Confirm or name the families above.
3. **Official reversed lockups.** Confirm or replace the derived files.
