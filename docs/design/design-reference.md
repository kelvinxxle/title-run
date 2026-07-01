# Octagon Elite — Design System & Reference

## Visual Identity
**Brand Personality:** Gritty, high-stakes, elite, tactical.
**Color Palette:**
- **Primary (Championship Gold):** `#d4af37`
- **Surface (Deep Charcoal):** `#131313`
- **Background:** `#0e0e0e`
- **Contrast/Utility:** High-contrast white and muted grey variants for hierarchy.

## Typography
- **Primary Display:** `ANTON` (Uppercase, heavy weight)
- **Secondary/UI:** High-legibility sans-serif
- **Scale:**
  - Display LG (Mobile): Large, bold, tracking-wider for headlines.
  - Body LG: Uppercase for status and labels.
  - Label Caps: For navigation and metadata.

## Core Component Tokens
### Navigation
- **TopAppBar:** Fixed top, dark surface, gold brand logo (`TITLE RUN`).
- **BottomNavBar:** Fixed bottom, labeled icons (HOME, STATS, REIGNS), gold active state.

### Tactical Cards
- **Container:** Rounded-lg, surface-bright or custom primary borders.
- **Visuals:** High-contrast images with dark overlays for text readability.
- **Actions:** Large, tactile buttons (`bg-primary` for main actions).

## Screen Reference: Championship Hub
**ID:** `{{DATA:SCREEN:SCREEN_7}}`
**Role:** Central command center and reign tracker.
**Key Sections:**
1. **Hero Section:** Displays "THE G.O.A.T." status with active reign defenses and total wins.
2. **Hall of Fame:** Vertical list of all-time best records (Defenses vs Name).
3. **Primary Actions:** "START NEW RUN" (Secondary/Gold) and "RESUME RUN" (Tertiary).

## Implementation Notes
- **Roundness:** Sharp to slightly rounded (Octagon-inspired).
- **Interactions:** Subtle scale transforms (`active:scale-95`) and transition-opacity on hover.
- **Separation:** 2px borders using `border-outline-variant` for structural clarity.