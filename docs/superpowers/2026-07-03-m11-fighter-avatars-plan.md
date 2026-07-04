# M11 — Fighter Avatars — Implementation Plan

**Design basis:** `2026-07-03-fighter-avatars-design.md` (locked, Approach A: procedural SVG "fighter bust", deterministic per fighter, archetype-tinted, copyright-safe).
**Branch:** off `main` @ the M10 merge (`8e42246` or later). One PR into `main`. Do NOT merge (orchestrator reviews→merges→deploys).
**Milestone goal (WHY):** the 40-fighter roster + the player's custom fighter + procedural opponents are all text-only. User: "some pictures of the fighters might be cool." Give every fighter a distinct, deterministic, on-theme, copyright-safe portrait across roll / draft / hub / fight.

## HARD CONSTRAINT (non-negotiable)
**No real fighter photos, no recognizable real-person likenesses.** Avatars are original, generated, stylized SVG only. No network, no image assets, no new deps.

## Global constraints (every task)
- Deterministic: same seed ⇒ identical SVG. **No `Math.random` anywhere in `src/`** (use a tiny pure string hash of the seed, or `createRng(seed)` from `../rng`).
- Client-only, offline, no new dependencies (`package.json`/lockfile unchanged). Inline SVG paths only — no external/base64 images.
- TypeScript strict, no `any`. Tailwind classes consistent with existing components.
- Pure/presentational: `FighterAvatar` has no side effects and no state.
- A11y: `role="img"` + `aria-label={`${name} portrait`}`.
- Every commit ends with exactly one verbatim trailer: `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- Strict TDD (RED→GREEN→commit), push + verify `HEAD==@{u}` after every commit.

## Avatar identity resolution (the crux — different surfaces expose different data)
`FighterAvatar` keys **features** off a generic stable string `seed` and **palette/accent** off `archetype` (a string; unknown values fall back to a neutral palette, so the opponent's `archetype: string` type is safe):

| Surface | Fighter | `seed` | `archetype` | `name` (aria) |
|---|---|---|---|---|
| RolledFighterCard (draft roll) | real roster fighter | `fighter.id` | `fighter.archetype` | `fighter.name` |
| DraftScreen "Fighter Ready" reveal | player custom fighter | `state.name` | `archetypeFromStatLine(drafted.statLine)` | `state.name` |
| ChampionshipHubScreen — player | player custom fighter | `fighter.name` | `archetypeFromStatLine(fighter.statLine)` | `fighter.name` |
| ChampionshipHubScreen — next opponent | procedural opponent | `opponent.name` | `opponent.archetype` | `opponent.name` |
| FightView — player corner | player custom fighter | `playerName` | `archetypeFromStatLine(player.statLine)` | `playerName` |
| FightView — opponent corner | procedural opponent | `opponent.name` | `opponent.archetype` | `opponent.name` |

All seeds are deterministic (real ids are fixed; `generateOpponent` is seeded so opponent names are stable per fight; the player name is user-fixed for the run). Name collisions (two runs, same player name) intentionally produce the same face — acceptable.

## Component signature (refinement of the design's `fighterId` → generic `seed`)
```ts
// src/components/FighterAvatar.tsx
export interface FighterAvatarProps {
  seed: string;            // stable identity: real id | player name | opponent name
  archetype: string;       // ArchetypeId; unknown → neutral palette (opponent archetype is typed `string`)
  name: string;            // for aria-label only
  size?: number;           // px, default 48
}
export default function FighterAvatar(props: FighterAvatarProps): JSX.Element
```

---

## Task 1 — `archetypeFromStatLine` domain helper (player has no archetype)
**Files:** `src/domain/combat/archetypes.ts` (add export) + `src/domain/combat/archetypes.test.ts` (or a new `archetypeFromStatLine.test.ts`). Export through the combat barrel (`index.ts` already does `export * from './archetypes'`).

Pure function mapping a `StatLine` to the archetype it most resembles, for the player's cosmetic accent:
```ts
export function archetypeFromStatLine(s: StatLine): ArchetypeId
```
Rule (deterministic, tie-broken by a fixed order): compare the three offensive stats `striking / takedowns / submissions` → `striker / wrestler / grappler` by the max; if the top two offensive stats are within a small band (e.g. ≤ 5) treat as balanced → `allrounder`. (`brawler` is a roster-flavor archetype; not required for player derivation.)

**TDD RED-first:**
- a striking-dominant line → `'striker'`; takedown-dominant → `'wrestler'`; submission-dominant → `'grappler'`; a near-balanced line → `'allrounder'`.
- deterministic (same input twice → same output); returns a valid `ArchetypeId` for every roster fighter's built stat line.
Confirm RED (function absent) → implement → GREEN → commit.

## Task 2 — `FighterAvatar` component + deterministic feature generator (CORE)
**Files:** NEW `src/components/FighterAvatar.tsx` + `src/components/FighterAvatar.test.tsx`.

Implement a pure feature derivation from `seed` (tiny string hash or `createRng(seed)`) selecting from small discrete sets so the 40 real ids read as 40 distinct fighters, e.g.: skin tone (fixed on-theme palette), head/hair/headgear variant, trunks/glove color, brow/jaw variant. `archetype` sets the accent ring + accent color via a palette map (`striker`→red, `wrestler`→blue, `grappler`→purple, `allrounder`→green, `brawler`→orange; unknown→neutral gray). Render a flat, bold, geometric head-and-gloves-up bust in inline `<svg>` paths (a stylized fighter, NOT a real person, NOT a plain identicon), sized by `size` (default 48), crisp from 40px to 96px. Root `<svg role="img" aria-label={`${name} portrait`} data-testid="fighter-avatar" width={size} height={size}>`.

**TDD RED-first (assert against rendered SVG):**
- **Deterministic:** same `seed` twice → identical serialized SVG markup.
- **Distinct spread:** rendering all 40 real roster ids (`ROSTER`/`getFighter`) yields ≥ 30 distinct SVG outputs (assert a minimum distinct count so the hash spreads across the pool — tune the threshold to what the feature space supports, but it MUST be well above 5).
- **Archetype accent:** each `ArchetypeId` → its expected accent color/class is present in the output; unknown archetype string → neutral fallback present (no throw).
- **Size:** `size={96}` → root svg has width/height 96; default (no size) → 48.
- **A11y:** `role="img"` and `aria-label` contains the passed `name`.
- **No `Math.random`** in the component source.
Confirm RED → implement → GREEN → commit.

## Task 3 — Wire avatars into draft + hub surfaces
**Files:** `src/components/RolledFighterCard.tsx`, `src/screens/DraftScreen.tsx`, `src/screens/ChampionshipHubScreen.tsx` (+ their tests).
- **RolledFighterCard:** render `<FighterAvatar seed={fighter.id} archetype={fighter.archetype} name={fighter.name} />` in the card header next to the name (`fighter = getFighter(state.current.fighterId)` already in scope).
- **DraftScreen "complete" reveal:** render the player avatar `seed={state.name}` `archetype={archetypeFromStatLine(getDraftedFighter(state).statLine)}` `name={state.name!}` above/next to the "Fighter Ready" name.
- **ChampionshipHubScreen:** player avatar for `run.fighter` (`seed={fighter.name}`, `archetype={archetypeFromStatLine(fighter.statLine)}`) in the player block; opponent avatar in the "next-opponent" block (`seed={opponent.name}`, `archetype={opponent.archetype}`). `opponent = generateOpponent(run.seed, run.fightNumber)` already in scope.
- Keep all existing layout/testids intact; avatars slot into current headers.

**TDD RED-first (light render tests, one per surface):** each surface renders a `fighter-avatar` with the expected `aria-label` for the shown fighter (e.g. Hub pre-fight shows both the player's and the opponent's avatar; RolledFighterCard shows the rolled fighter's). Confirm RED (no avatar yet) → wire → GREEN → commit. Don't break existing tests.

## Task 4 — Wire avatars into the fight corners
**Files:** `src/components/FighterHealthCard.tsx`, `src/screens/FightView.tsx` (+ their tests).
- Add optional props to `FighterHealthCard`: `avatarSeed?: string; archetype?: string`. When both present, render `<FighterAvatar seed={avatarSeed} archetype={archetype} name={name} size={40} />` in the card header (next to the name/badge). When absent, render exactly as today (back-compat — existing FighterHealthCard tests must stay green untouched).
- `FightView` passes: player card `avatarSeed={playerName}` `archetype={archetypeFromStatLine(player.statLine)}`; opponent card `avatarSeed={opponent.name}` `archetype={opponent.archetype}` (both `player.statLine` and `opponent.name/archetype` are already destructured from `fightState`).

**TDD RED-first:** FightView renders two `fighter-avatar`s (player + opponent) with the right aria-labels; FighterHealthCard renders an avatar only when the avatar props are supplied. Confirm RED → wire → GREEN → commit.

## Task 5 — Final gate + determinism sweep (fold into last commit if trivial)
- Full gate: `npx vitest run` (all green, count up vs the 192 M10 baseline), `npx tsc --noEmit` clean, `npx vite build` ok.
- `grep -rn 'Math.random(' src` → 0 invocations; `git diff --stat` shows `package.json`/lockfile unchanged.
- Sanity: every avatar surface shows an avatar; the same fighter shows the same face across surfaces (real id / player name / opponent name are stable).

## File Map (scope — nothing outside this)
- NEW: `src/components/FighterAvatar.tsx` (+ `.test.tsx`)
- EDIT: `src/domain/combat/archetypes.ts` (+ `.test.ts`) — add `archetypeFromStatLine`
- EDIT: `src/components/RolledFighterCard.tsx`, `src/components/FighterHealthCard.tsx` (+ tests)
- EDIT: `src/screens/DraftScreen.tsx`, `src/screens/ChampionshipHubScreen.tsx`, `src/screens/FightView.tsx` (+ tests)
- NO roster/archetype-stat changes, NO combat-engine changes, NO persistence changes, NO new deps.

## Definition of Done
`vitest run` green (count > 192), `tsc --noEmit` clean, `vite build` ok, no new deps, no `Math.random` in `src`, TS strict/no-`any`. 40 distinct deterministic roster avatars + player + opponent avatars visible across roll/draft/hub/fight. One PR into `main`, CI `build-and-test` green, `HEAD==@{u}`, all commit trailers exact. Report back: PR#, HEAD, per-task RED-first evidence (esp. Task 2 determinism + distinct-spread), trailer audit, gate + CI, any deviations. Do NOT merge.

## Workflow
subagent-driven-development (fresh implementer + reviewer per task; Task 2 is the substantive one — use a capable model). Strict TDD. After each task: gate + push + verify `HEAD==@{u}`. Open one PR into `main`; do NOT merge.
