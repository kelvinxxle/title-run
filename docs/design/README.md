# Design References

UI/UX references for **Title Run**. These are visual mockups and the design system
for Copilot and contributors to reference during implementation. They are references,
not final assets — the PRD in [`docs/prd.md`](../prd.md) remains the source of truth for
scope and behavior.

## Design system

- [`design-system.md`](design-system.md) — the **"Octagon Elite"** design system:
  full color palette, typography, spacing, elevation, shapes, and component tokens
  (front-matter tokens plus written guidance).
- [`design-reference.md`](design-reference.md) — condensed design + screen reference
  (visual identity, navigation, tactical cards, Championship Hub notes).

**At a glance:** dark-mode-first, deep charcoal canvas (`#131313`), Championship Gold
primary (`#d4af37`), Octagon Blood Red secondary for intensity. Sharp edges (0px radius).
Type: **Anton** (headlines, uppercase), **Archivo Narrow** (body), **Space Mono** (stats).

## Screens

Each folder has a static `mockup.html` (self-contained HTML/CSS) and a `screen.png`
screenshot. Screens map to the PRD's core loop:

| Screen | Folder | PRD phase |
| --- | --- | --- |
| Championship Hub | [`screens/championship-hub/`](screens/championship-hub/) | Home / reign tracker + start/resume run |
| Octagon Fighter Draft | [`screens/fighter-draft/`](screens/fighter-draft/) | Draft — roll a fighter, keep one stat per slot |
| Octagon Tactical Intent | [`screens/tactical-intent/`](screens/tactical-intent/) | Fight — pick one round-by-round intent |
| Post-Fight Reward | [`screens/post-fight-reward/`](screens/post-fight-reward/) | Reward — bump stat / re-roll / recover damage |

To view a mockup, open its `mockup.html` in a browser.

## Notes

- Mockups may show illustrative fighters/stats; treat them as visual direction, not
  final content. Real-fighter roster and tuning are defined during implementation.
- PNGs are committed for quick reference without running the HTML.
