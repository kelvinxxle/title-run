# M13 — Real Fighter Images (design, LOCKED)

**Date:** 2026-07-04
**Milestone:** M13 (follows M12; builds on merged-M12 `main`)
**Why:** User rejected M11's abstract procedural avatars ("garbage — I wanted pictures of the real fighters"). Copyright is a NON-ISSUE (personal project). Real photos AND AI-generated (Google Stitch) images both acceptable.
**User-chosen approach:** **HYBRID** — build the image-display system + graceful fallback + fetch real photos NOW (works immediately); user can swap in Stitch hero renders per-fighter later with **zero code change**.
**User-chosen scope:** **Dramatic hero card on the draft reveal + clean portraits in hub/fight corners.** (Not a full every-screen redesign.)

---

## 1. The drop-in convention (the hybrid enabler)
- Real-fighter images live at **`public/fighters/{id}.jpg`**, keyed by roster `Fighter.id` (e.g. `public/fighters/jon-jones.jpg`).
- Served at `/title-run/fighters/{id}.jpg` (respects Vite `base`).
- **To swap in a Stitch render later:** drop/replace `public/fighters/{id}.jpg`. No code, no rebuild-config, no manifest edit. The `<img src>` is derived purely from `id`.
- The player's CUSTOM fighter has NO stable id → always uses the fallback (below). Same for the 2 fictional gatekeepers.

## 2. Image source (fetched NOW, so it works immediately)
- **38 of 40** roster fighters are real → each has a **verified, recognizable, freely-licensed lead photo** from Wikipedia (Commons-hosted). Manifest already built + spot-check-verified (disambiguated + accented names confirmed correct): `files/2026-07-04-fighter-image-manifest.json` (id → {title, orig URL, thumb URL}).
- **2 fictional gatekeepers** (`journeyman-doe`, `rudy-kane`) have no real photo → fallback.
- Images are **portrait/press shots** (head-and-shoulders), NOT full-body octagon renders. Honest expectation set with user: real photos look like strong cropped portraits under the gritty treatment; full-body drama comes from user's later Stitch swaps into the same slots.
- Download the manifest `orig` per fighter → `public/fighters/{id}.jpg`. Total ~5.7 MB (avg 150 KB; only 4 >500 KB). Build MAY `sips -Z 800` any image >500 KB to trim, but not required.
- Generate `public/fighters/CREDITS.md` from the manifest (fighter → Wikipedia/Commons source URL) — respectful attribution for the CC images; cheap.

## 3. Fallback (never break; hybrid-friendly)
- New display component (`FighterImage`, name TBD in plan) renders `<img src="/title-run/fighters/{id}.jpg" alt="{name}">`.
- **On missing image (`<img>` onError) OR no id → fall back to the existing M11 `FighterAvatar`** (procedural, archetype-tinted SVG). M11's work becomes the fallback layer — not wasted.
- Runtime onError (not a hardcoded has-image set) is deliberate: it means a later drop-in for ANY id (incl. a future player image) "just works."
- Player custom fighter: no id → renders `FighterAvatar` (archetype via M11 `archetypeFromStatLine`). Unchanged from M11 behavior.

## 4. Visual treatment
**Brand (from `docs/design/design-reference.md`):** gritty charcoal `#131313`, gold `#d4af37`, ANTON display font, high-contrast image + dark overlay.

- **Draft reveal card (`RolledFighterCard`) = DRAMATIC HERO.** Large fighter image fills the card; dark bottom-to-top gradient scrim; fighter name in ANTON + archetype label overlaid at the bottom; gold accent. Matches the Google Stitch reference composition (`docs/design/screens/fighter-draft/screen.png`). This is the one "wow" moment.
- **Hub (`ChampionshipHubScreen`) — player + next opponent:** clean recognizable **portrait thumbnail** in the existing avatar slot (swap procedural → real photo, same fallback). No layout redesign.
- **Fight corners (`FightView` via `FighterHealthCard`):** clean portrait thumbnail in the existing corner avatar slots. No layout redesign.

## 5. Opponent image keying (RESOLVED vs merged-M12 code — pure name→id resolver, no state change)
- M12 `generateOpponent` returns `Opponent = { id, name, archetype, statLine }` (carries roster `id`). BUT `FightState.opponent` (fightState.ts:54) is `Fighter2 & { name, archetype }` and the builder (fightState.ts:92) **drops id**. So mid-fight, `state.opponent` has `name` but no `id`.
- **CHOSEN keying = a pure resolver `fighterIdByName(name): string | undefined` over `STARTER_ROSTER`** (real fighter names are unique). This is SAFER than threading `id` through FightState (which would risk the persistence/resume schema). Rationale:
  - **Draft cards (`RolledFighterCard`)**: the rolled fighter is a real roster `Fighter` → use `fighter.id` directly.
  - **Hub next-opponent preview (`ChampionshipHubScreen`)**: already holds the `Opponent` with `id` → use `opponent.id` directly.
  - **Fight corners (`FightView`/`FighterHealthCard`)**: read `FightState.opponent.name` → `fighterIdByName(name)` → id → image. `opponent.name` === `fighter.name` exactly (set in generateOpponent then createFightState), so it resolves.
  - **Player custom fighter**: its custom name is NOT in the roster → `fighterIdByName` returns `undefined` → avatar fallback. ONE mechanism cleanly handles opponent (real→image) AND player (custom→fallback) with **zero** fightState/persistence/engine change.
- So M13 touches NO engine/persistence files. `fighterIdByName` is a tiny pure addition to `roster.ts` (or a helper), with a unit test (real name→id; custom/unknown name→undefined).

## 6. Scope boundaries (keep tight — PM discipline)
**In scope:** `public/fighters/*` assets + `CREDITS.md`; new `FighterImage` component (wraps/falls-back-to `FighterAvatar`); wire into `RolledFighterCard` (dramatic hero) + `ChampionshipHubScreen` + `FightView`/`FighterHealthCard` (portrait swap); RTL tests (image renders when present; onError → avatar fallback; player→fallback; draft hero composition; a11y alt=name); optional opponent name→id resolver.
**Out of scope:** NO combat-engine / roster-stat / persistence / balance changes. NO `Math.random`. NO new runtime deps (asset download is a build-time curl; `sips` optional macOS-only trim). Determinism unaffected (images are static assets, not RNG).

## 7. Sequencing
- M12 (adaptive AI + real opponents + balance) is mid-flight and orthogonal. **Do NOT interrupt.** Let M12 review → merge → deploy first.
- M13 branches off merged-M12 `main`; real opponents + real faces combine well. Finalize §5 opponent keying against merged M12, then launch M13 build.

## 8. Definition of done
- All 38 real fighters show their photo on draft/hub/fight surfaces; 2 fictional + player show the procedural fallback; a deleted/renamed image cleanly falls back (no broken-image icon).
- Draft reveal card is the dramatic hero treatment (image + gradient + ANTON name overlay).
- Dropping a new `public/fighters/{id}.jpg` swaps that fighter's image with no code change (verified for at least one id).
- Full gate green (vitest/tsc/build), CI green on exact PR HEAD, exact `Co-authored-by: Copilot App` trailer per commit, one PR, do-not-merge-until-reviewed.
