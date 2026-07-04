# M13 — Real Fighter Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace M11's abstract procedural avatars with real recognizable photos of the 40 roster fighters — a dramatic hero image on the draft reveal and clean portraits in the hub/fight corners — with a drop-in convention so the user can swap in AI-generated (Google Stitch) hero renders later with zero code change, and a graceful fallback to the existing procedural avatar whenever an image is absent.

**Architecture:** Real images live as static assets at `public/fighters/{id}.jpg`, keyed by roster `Fighter.id`. A new presentational `FighterImage` component renders `<img>` when the image loads and falls back to the existing M11 `FighterAvatar` on error or when no id is available (player custom fighter + 2 fictional gatekeepers). Roster fighters (draft) key by `fighter.id` directly; the mid-fight opponent (whose `FightState.opponent` carries only `name`) is keyed via a new pure `fighterIdByName(name)` resolver — so **no engine/persistence change is needed**. The 38 real-fighter photos are fetched once from Wikipedia/Commons (freely licensed) via a committed provenance script + manifest.

**Tech Stack:** React 18, TypeScript (strict, no `any`), Vite (base `/title-run/`), Tailwind (design tokens: `font-display`=ANTON, `text-primary`=gold `#d4af37`, `bg-surface-container`, `border-outline`), Vitest + React Testing Library (jsdom). Seeded RNG only.

## Global Constraints

- **No `Math.random`** anywhere in `src/` — the avatar fallback uses the existing seeded `createRng`. (Doc prose may mention the term.)
- **No new runtime dependencies** — `package.json` / `package-lock.json` MUST be unchanged. Image fetching is a one-off dev script using Node's built-in `fetch`/`fs` (not imported by the app).
- **TypeScript strict, no `any`.** `tsc --noEmit` must stay clean.
- **Determinism preserved** — images are static assets (not RNG); the avatar fallback keeps its existing seeded determinism.
- **Image `src` must respect Vite base:** always build as `` `${import.meta.env.BASE_URL}fighters/${id}.jpg` `` (BASE_URL is `/` in dev/test, `/title-run/` in prod, and ends in `/`).
- **Exact commit trailer** on every commit: `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- **One PR into `main`; CI green; do NOT merge** — the orchestrator reviews → merges → deploys.
- **Scope:** assets + provenance script + `FighterImage` + `fighterIdByName` + wiring into `RolledFighterCard` (dramatic hero) and hub/fight portraits. NO combat-engine / roster-stat / persistence / balance changes.
- **Fallback is runtime `onError`** (not a hardcoded has-image set) so a later drop-in `public/fighters/{id}.jpg` for ANY id "just works."

---

## File Structure

- `scripts/fighter-image-manifest.json` — **Create.** Provided manifest: `fighters[id] = { id, title, orig, thumb }` for the 38 real fighters + `noImage: ['journeyman-doe','rudy-kane']`. Provenance/reproducibility (also lets the user re-fetch).
- `scripts/fetch-fighter-images.mjs` — **Create.** One-off Node script that downloads each `orig` → `public/fighters/{id}.jpg` and writes `public/fighters/CREDITS.md`. Not imported by the app.
- `public/fighters/*.jpg` — **Create (38 binaries).** The real-fighter photos, committed.
- `public/fighters/CREDITS.md` — **Create.** Generated attribution list.
- `src/domain/combat/roster.ts` — **Modify.** Add pure `fighterIdByName(name): string | undefined`.
- `src/domain/combat/index.ts` — **Modify (if barrel exists).** Re-export `fighterIdByName`.
- `src/components/FighterImage.tsx` — **Create.** Photo-with-avatar-fallback component.
- `src/components/RolledFighterCard.tsx` — **Modify.** Dramatic hero image treatment.
- `src/screens/ChampionshipHubScreen.tsx` — **Modify.** Swap player + next-opponent avatars → `FighterImage` portraits.
- `src/components/FighterHealthCard.tsx` — **Modify.** Swap `FighterAvatar` → `FighterImage`; add optional `fighterId?` prop.
- `src/screens/FightView.tsx` — **Modify.** Pass `fighterId={fighterIdByName(opponent.name)}` to the opponent corner (player corner stays fallback).
- `src/screens/DraftScreen.tsx` — **Inspect/Modify only if** it renders `FighterAvatar` directly (the rolled card is `RolledFighterCard`).
- Tests: `src/domain/combat/roster.test.ts` (or existing), `src/components/FighterImage.test.tsx`, `src/components/RolledFighterCard.test.tsx`, `src/screens/ChampionshipHubScreen.test.tsx`, `src/screens/FightView.test.tsx` / `src/components/FighterHealthCard.test.tsx`, `src/assets/fighter-images.test.ts` (coverage).

---

## Task 0: Commit design + plan docs

**Files:**
- Create: `docs/superpowers/2026-07-04-m13-real-fighter-images-design.md` (provided)
- Create: `docs/superpowers/2026-07-04-m13-real-fighter-images-plan.md` (this file)

- [ ] **Step 1: Add both docs** (provided in the handoff) under `docs/superpowers/`.
- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/2026-07-04-m13-*.md
git commit -m "docs: M13 real fighter images design + plan

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 1: `fighterIdByName` resolver

**Files:**
- Modify: `src/domain/combat/roster.ts`
- Modify: `src/domain/combat/index.ts` (barrel re-export, if present)
- Test: `src/domain/combat/roster.test.ts` (create if absent)

**Interfaces:**
- Produces: `fighterIdByName(name: string): string | undefined` — exact roster-name → id; unknown/custom name → `undefined`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest';
import { fighterIdByName } from './roster';

describe('fighterIdByName', () => {
  it('maps an exact roster name to its id', () => {
    expect(fighterIdByName('Jon Jones')).toBe('jon-jones');
  });
  it('handles apostrophes/accents', () => {
    expect(fighterIdByName("Sean O'Malley")).toBe('sean-omalley');
    expect(fighterIdByName('José Aldo')).toBe('jose-aldo');
  });
  it('returns undefined for a custom (player) name', () => {
    expect(fighterIdByName('Kid Dynamite McCustom')).toBeUndefined();
  });
});
```
- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/domain/combat/roster.test.ts`
Expected: FAIL — `fighterIdByName is not a function`.
- [ ] **Step 3: Write minimal implementation** (append to `roster.ts`)
```ts
const _idByName: ReadonlyMap<string, string> = new Map(
  STARTER_ROSTER.map((f) => [f.name, f.id]),
);
export function fighterIdByName(name: string): string | undefined {
  return _idByName.get(name);
}
```
If `src/domain/combat/index.ts` is a barrel, add: `export { fighterIdByName } from './roster';`
- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/domain/combat/roster.test.ts` → Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/domain/combat/roster.ts src/domain/combat/index.ts src/domain/combat/roster.test.ts
git commit -m "feat(roster): add pure fighterIdByName resolver

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: `FighterImage` component (photo + avatar fallback)

**Files:**
- Create: `src/components/FighterImage.tsx`
- Test: `src/components/FighterImage.test.tsx`

**Interfaces:**
- Consumes: `FighterAvatar` (default export, props `{ seed, archetype, name, size? }`).
- Produces: default export `FighterImage(props: FighterImageProps)` where
```ts
export interface FighterImageProps {
  fighterId?: string;              // roster id; absent/unresolved → avatar fallback
  name: string;                    // <img> alt + avatar name
  archetype: string;               // avatar fallback tint
  seed?: string;                   // avatar fallback seed (default: fighterId ?? name)
  size?: number;                   // portrait px (default 48); ignored for hero
  variant?: 'portrait' | 'hero';   // default 'portrait'
}
```
- Photo `<img>` uses `alt={name}` and `data-testid="fighter-photo"`. Avatar fallback keeps its `aria-label={`${name} portrait`}`. (Distinct accessible names let tests target each unambiguously.)

- [ ] **Step 1: Write the failing test**
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FighterImage from './FighterImage';

describe('FighterImage', () => {
  it('renders the fighter photo keyed by id (base-prefixed src, alt=name)', () => {
    render(<FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" />);
    const img = screen.getByTestId('fighter-photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/fighters\/jon-jones\.jpg$/);
    expect(img).toHaveAttribute('alt', 'Jon Jones');
    // avatar fallback not shown while the photo is present
    expect(screen.queryByLabelText('Jon Jones portrait')).toBeNull();
  });

  it('falls back to the procedural avatar when the image errors', () => {
    render(<FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" />);
    fireEvent.error(screen.getByTestId('fighter-photo'));
    expect(screen.getByLabelText('Jon Jones portrait')).toBeInTheDocument();
    expect(screen.queryByTestId('fighter-photo')).toBeNull();
  });

  it('renders the avatar directly when no fighterId (player custom fighter)', () => {
    render(<FighterImage name="Kid Dynamite" archetype="brawler" />);
    expect(screen.getByLabelText('Kid Dynamite portrait')).toBeInTheDocument();
    expect(screen.queryByTestId('fighter-photo')).toBeNull();
  });
});
```
- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/FighterImage.test.tsx`
Expected: FAIL — cannot resolve `./FighterImage`.
- [ ] **Step 3: Write minimal implementation**
```tsx
import { useState } from 'react';
import FighterAvatar from './FighterAvatar';

export interface FighterImageProps {
  fighterId?: string;
  name: string;
  archetype: string;
  seed?: string;
  size?: number;
  variant?: 'portrait' | 'hero';
}

export default function FighterImage({
  fighterId, name, archetype, seed, size = 48, variant = 'portrait',
}: FighterImageProps): JSX.Element {
  const [errored, setErrored] = useState(false);
  const avatarSeed = seed ?? fighterId ?? name;

  if (!fighterId || errored) {
    if (variant === 'hero') {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
          <FighterAvatar seed={avatarSeed} archetype={archetype} name={name} size={220} />
        </div>
      );
    }
    return <FighterAvatar seed={avatarSeed} archetype={archetype} name={name} size={size} />;
  }

  const src = `${import.meta.env.BASE_URL}fighters/${fighterId}.jpg`;
  if (variant === 'hero') {
    return (
      <img
        data-testid="fighter-photo"
        src={src}
        alt={name}
        onError={() => setErrored(true)}
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
    );
  }
  return (
    <img
      data-testid="fighter-photo"
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className="rounded object-cover"
      style={{ width: size, height: size }}
    />
  );
}
```
- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/FighterImage.test.tsx` → Expected: PASS (3/3).
- [ ] **Step 5: Commit**
```bash
git add src/components/FighterImage.tsx src/components/FighterImage.test.tsx
git commit -m "feat(ui): FighterImage — real photo with procedural avatar fallback

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Fetch + commit the 38 real-fighter images

**Files:**
- Create: `scripts/fighter-image-manifest.json` (provided in handoff — copy verbatim)
- Create: `scripts/fetch-fighter-images.mjs`
- Create: `public/fighters/*.jpg` (38) + `public/fighters/CREDITS.md`
- Test: `src/assets/fighter-images.test.ts`

**Interfaces:**
- Consumes: `STARTER_ROSTER` (for the coverage test).

- [ ] **Step 1: Add the manifest** — copy the provided `fighter-image-manifest.json` to `scripts/`.
- [ ] **Step 2: Write the fetch script** `scripts/fetch-fighter-images.mjs`
```js
import fs from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(fs.readFileSync('scripts/fighter-image-manifest.json', 'utf8'));
const OUT = 'public/fighters';
const UA = 'TitleRunPersonalProject/1.0 (personal use)';
fs.mkdirSync(OUT, { recursive: true });

const entries = Object.values(manifest.fighters);
let credits = '# Fighter image credits\n\nImages sourced from Wikipedia / Wikimedia Commons (freely licensed). Personal, non-commercial project.\n\n';
for (const f of entries) {
  const res = await fetch(f.orig, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`fetch failed for ${f.id}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(OUT, `${f.id}.jpg`), buf);
  credits += `- **${f.id}** — ${f.title} — ${f.orig}\n`;
  console.log('saved', f.id, buf.length, 'bytes');
}
fs.writeFileSync(path.join(OUT, 'CREDITS.md'), credits);
console.log('DONE:', entries.length, 'images');
```
- [ ] **Step 3: Write the failing coverage test** `src/assets/fighter-images.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { STARTER_ROSTER } from '../domain/combat/roster';

const NO_IMAGE = new Set(['journeyman-doe', 'rudy-kane']); // fictional → avatar fallback

describe('shipped fighter images', () => {
  for (const f of STARTER_ROSTER) {
    if (NO_IMAGE.has(f.id)) continue;
    it(`has a non-empty public/fighters/${f.id}.jpg`, () => {
      const p = `public/fighters/${f.id}.jpg`;
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).size).toBeGreaterThan(1000);
    });
  }
  it('writes a CREDITS.md', () => {
    expect(fs.existsSync('public/fighters/CREDITS.md')).toBe(true);
  });
});
```
- [ ] **Step 4: Run to verify it fails**
Run: `npx vitest run src/assets/fighter-images.test.ts`
Expected: FAIL — files do not exist yet.
- [ ] **Step 5: Run the fetch script**
Run: `node scripts/fetch-fighter-images.mjs`
Expected: prints `saved …` for 38 ids then `DONE: 38 images`. (If any single fetch 404s transiently, re-run; the script is idempotent.)
- [ ] **Step 6: Run the coverage test to verify it passes**
Run: `npx vitest run src/assets/fighter-images.test.ts` → Expected: PASS (38 + CREDITS).
- [ ] **Step 7: Commit**
```bash
git add scripts/fighter-image-manifest.json scripts/fetch-fighter-images.mjs public/fighters src/assets/fighter-images.test.ts
git commit -m "feat(assets): fetch + commit 38 real fighter photos (Wikimedia) with provenance

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Dramatic hero image on the draft reveal (`RolledFighterCard`)

**Files:**
- Modify: `src/components/RolledFighterCard.tsx`
- Modify: `src/screens/DraftScreen.tsx` (only if it renders `FighterAvatar` directly)
- Test: `src/components/RolledFighterCard.test.tsx`

**Interfaces:**
- Consumes: `FighterImage` (Task 2); `getFighter(id)` → `{ id, name, archetype }`.

**Design:** Replace the small avatar+name row with a large hero: a `relative` container (fixed height, e.g. `h-64`) holding `FighterImage variant="hero"` (fills, `object-cover`), an absolute bottom-up dark gradient scrim, and the fighter **name** (`font-display` ANTON, `text-primary` gold, large, uppercase) + **archetype** overlaid at the bottom. Keep the stat rows below unchanged. Container gets `data-testid="draft-hero"`.

- [ ] **Step 1: Update the existing test to assert the hero treatment (RED)**
Replace the avatar-row assertion(s) in `RolledFighterCard.test.tsx` with:
```tsx
it('shows a dramatic hero photo keyed by the rolled fighter id + name overlay', () => {
  // render RolledFighterCard with a DraftState whose current.fighterId = 'conor-mcgregor'
  // (reuse the file's existing render helper / fixture)
  const img = screen.getByTestId('fighter-photo') as HTMLImageElement;
  expect(img.getAttribute('src')).toMatch(/fighters\/conor-mcgregor\.jpg$/);
  expect(img).toHaveAttribute('alt', 'Conor McGregor');
  expect(screen.getByTestId('draft-hero')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Conor McGregor/i })).toBeInTheDocument();
});
```
Keep the existing stat-row assertions intact.
- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/components/RolledFighterCard.test.tsx`
Expected: FAIL — no `fighter-photo` / `draft-hero` (still the old avatar).
- [ ] **Step 3: Implement the hero treatment** — in `RolledFighterCard.tsx`, replace the avatar+name flex row with:
```tsx
import FighterImage from './FighterImage';
// ...
<div data-testid="draft-hero" className="relative h-64 w-full overflow-hidden border-b-2 border-outline">
  <FighterImage fighterId={fighter.id} name={fighter.name} archetype={fighter.archetype} variant="hero" />
  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
  <div className="absolute inset-x-0 bottom-0 p-md">
    <h3 className="font-display text-4xl uppercase leading-none text-primary drop-shadow">
      {fighter.name}
    </h3>
    <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
      {fighter.archetype}
    </p>
  </div>
</div>
```
(Remove the old `<FighterAvatar …>` import/usage from this file. Leave the stat-row block below untouched.)
- [ ] **Step 4: Handle `DraftScreen` complete view** — its "Fighter Ready" screen renders the drafted **custom** fighter (no roster id) via `<FighterAvatar seed={state.name!} archetype={archetypeFromStatLine(drafted.statLine)} name={state.name!} />`. Swap it to `FighterImage` (no `fighterId` → identical avatar fallback, seed preserved) so all fighter visuals route through one component:
```tsx
import FighterImage from '../components/FighterImage'; // replaces the FighterAvatar import
// ...
<FighterImage name={state.name!} archetype={archetypeFromStatLine(drafted.statLine)} seed={state.name!} />
```
Existing `DraftScreen` tests assert the drafted name (`fighter-name`) + `aria-label="${state.name} portrait"` (the fallback avatar keeps that) → they stay green.
- [ ] **Step 5: Run to verify it passes**
Run: `npx vitest run src/components/RolledFighterCard.test.tsx` → Expected: PASS.
- [ ] **Step 6: Commit**
```bash
git add src/components/RolledFighterCard.tsx src/components/RolledFighterCard.test.tsx src/screens/DraftScreen.tsx
git commit -m "feat(ui): dramatic real-photo hero card on the draft reveal

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Portrait swaps — hub + fight corners

**Files:**
- Modify: `src/screens/ChampionshipHubScreen.tsx`
- Modify: `src/components/FighterHealthCard.tsx` (swap `FighterAvatar` → `FighterImage`, add `fighterId?` prop)
- Modify: `src/screens/FightView.tsx` (pass `fighterId` to the opponent corner)
- Test: `src/screens/ChampionshipHubScreen.test.tsx`, `src/screens/FightView.test.tsx`

**Interfaces:**
- Consumes: `FighterImage` (Task 2); `fighterIdByName` (Task 1); `archetypeFromStatLine` (already exported from `../domain/combat`).
- **Keying facts (verified against `main`):**
  - Hub: `opponent = generateOpponent(run.seed, run.fightNumber)` returns an `Opponent` **with `id`** → key the opponent portrait by `opponent.id`.
  - Hub player: `run.fighter = { name, statLine }` — **no `id`, no `archetype`.** Omit `fighterId` (→ avatar fallback); derive tint with `archetypeFromStatLine(fighter.statLine)`; seed by `fighter.name` (mirrors current M11 wiring exactly).
  - Fight corner: `FightState.opponent` is `Fighter2 & { name, archetype }` — **`id` is dropped by `startFight`** → resolve with `fighterIdByName(opponent.name)`. `FightState.player` has no name/id here; `FightView` already passes `avatarSeed={playerName}` + `archetype={archetypeFromStatLine(player.statLine)}` → player stays fallback.

### 5a — Hub

- [ ] **Step 1: Write the failing test (RED)** in `ChampionshipHubScreen.test.tsx`. Derive the expected opponent (don't hardcode) exactly like the existing hub tests:
```tsx
import { generateOpponent } from '../domain/combat';
// render the hub in a pre-fight run state `run`, then:
const opp = generateOpponent(run.seed, run.fightNumber);
const oppImg = within(screen.getByTestId('next-opponent')).getByTestId('fighter-photo') as HTMLImageElement;
expect(oppImg.getAttribute('src')).toMatch(new RegExp(`fighters/${opp.id}\\.jpg$`));
expect(oppImg).toHaveAttribute('alt', opp.name);
```
- [ ] **Step 2: Run → FAIL** (`npx vitest run src/screens/ChampionshipHubScreen.test.tsx`) — still the avatar (`fighter-photo` absent).
- [ ] **Step 3: Implement hub swap** — replace `import FighterAvatar from '../components/FighterAvatar';` with `import FighterImage from '../components/FighterImage';`. Swap the **opponent** avatar:
```tsx
<FighterImage fighterId={opponent.id} name={opponent.name} archetype={opponent.archetype} seed={opponent.name} />
```
Swap the **player** avatar (no roster id → fallback; note `archetypeFromStatLine` is already imported in this file):
```tsx
<FighterImage name={fighter.name} archetype={archetypeFromStatLine(fighter.statLine)} seed={fighter.name} />
```
- [ ] **Step 4: Run → PASS.** Then run the whole hub test file — existing player/opponent-name assertions must stay green (the avatar keeps `aria-label="${name} portrait"` only in the fallback; the photo carries `alt`).
- [ ] **Step 5: Commit**
```bash
git add src/screens/ChampionshipHubScreen.tsx src/screens/ChampionshipHubScreen.test.tsx
git commit -m "feat(ui): real-photo portraits in the championship hub

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### 5b — Fight corners

- [ ] **Step 6: Write the failing test (RED)** in `FightView.test.tsx`. Build a fight whose opponent is a known roster fighter (name resolves via `fighterIdByName`), scope to the opponent corner by its existing testid `fighter-card-opponent`:
```tsx
// construct fightState via startFight with opponent { id:'jon-jones', name:'Jon Jones', archetype:'allrounder', statLine: buildStatLine(getFighter('jon-jones')) }
const img = within(screen.getByTestId('fighter-card-opponent')).getByTestId('fighter-photo') as HTMLImageElement;
expect(img.getAttribute('src')).toMatch(/fighters\/jon-jones\.jpg$/);
expect(img).toHaveAttribute('alt', 'Jon Jones');
// player corner stays a procedural avatar (no roster id):
expect(within(screen.getByTestId('fighter-card-player')).queryByTestId('fighter-photo')).toBeNull();
expect(within(screen.getByTestId('fighter-card-player')).getByLabelText(/portrait$/)).toBeInTheDocument();
```
- [ ] **Step 7: Run → FAIL** (`npx vitest run src/screens/FightView.test.tsx`).
- [ ] **Step 8: Implement — `FighterHealthCard.tsx`:** add `fighterId?: string;` to `FighterHealthCardProps`, destructure it, replace `import FighterAvatar from './FighterAvatar';` with `import FighterImage from './FighterImage';`, and swap the avatar render (keep the `avatarSeed && archetype` gate so back-compat callers that pass neither still render just the name):
```tsx
{avatarSeed && archetype ? (
  <div className="flex items-center gap-xs">
    <FighterImage fighterId={fighterId} name={name} archetype={archetype} seed={avatarSeed} size={40} />
    <h3 className="font-display text-2xl uppercase leading-tight text-on-surface">{name}</h3>
  </div>
) : (
  <h3 className="font-display text-2xl uppercase leading-tight text-on-surface">{name}</h3>
)}
```
- [ ] **Step 9: Implement — `FightView.tsx`:** add `fighterIdByName` to the `../domain/combat` import; pass `fighterId` on the **opponent** card only (player card unchanged → fallback):
```tsx
<FighterHealthCard side="opponent" name={opponent.name} subtitle={opponent.archetype} badge="OPP" healthPct={healthPct(opponent)} avatarSeed={opponent.name} archetype={opponent.archetype} fighterId={fighterIdByName(opponent.name)} />
```
- [ ] **Step 10: Run → PASS.** Then run the full `FightView` + `FighterHealthCard` test files — existing tests (which don't pass `fighterId`) must stay green.
- [ ] **Step 11: Commit**
```bash
git add src/components/FighterHealthCard.tsx src/screens/FightView.tsx src/screens/FightView.test.tsx
git commit -m "feat(ui): real-photo opponent portrait in the fight corners (via fighterIdByName)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Full gate + PR

- [ ] **Step 1: Full local gate**
```bash
npx vitest run            # all pass (M12 baseline 239 + new; run TWICE, identical)
npx vitest run
npx tsc --noEmit          # clean
npm run build             # ok
grep -rn 'Math.random(' src   # 0 matches
git diff --stat origin/main -- package.json package-lock.json   # empty
```
- [ ] **Step 2: Manual visual sanity (optional but recommended)** — `npm run dev`, roll a draft (hero photo fills the card + gold ANTON name overlay), start a run (hub + fight corners show real opponent faces), confirm a fictional gatekeeper (`journeyman-doe`/`rudy-kane`) and the player fall back to the procedural avatar with no broken-image icon.
- [ ] **Step 3: Push + open ONE PR into `main`** titled `M13: real fighter images — dramatic draft hero + portraits`. Body: summary, the drop-in convention (`public/fighters/{id}.jpg`), fallback behavior, image provenance (Wikimedia, CREDITS.md), test count delta, determinism/no-Math.random/no-new-deps. **Do NOT merge.**
- [ ] **Step 4: Verify** HEAD == `@{u}` == PR head; CI `build-and-test` green on the exact SHA; per-commit trailer audit; report the measured test count and the changed-file list.

---

## Self-Review (author checklist — done before handoff)

- **Spec coverage:** drop-in convention (T3 assets + `FighterImage` src) ✅; fetch real photos now (T3 script) ✅; fallback to M11 avatar (T2 onError + no-id) ✅; player custom fighter → fallback (T2 no-id; hub/corner omit fighterId, derive tint via `archetypeFromStatLine`) ✅; 2 fictional gatekeepers → fallback (T3 NO_IMAGE; onError at runtime) ✅; dramatic hero draft card (T4) ✅; clean portraits hub + fight (T5) ✅; opponent keying without engine/persistence change — hub by `opponent.id`, fight corner by `fighterIdByName(opponent.name)` (since `startFight` drops opponent `id`) ✅; brand ANTON/gold (T4) ✅; swap-in-later zero-code (runtime `onError`, id-keyed path) ✅.
- **Placeholder scan:** every code step shows concrete code; the only "inspect" branches (DraftScreen; which file holds the opponent corner) are genuine per-repo discovery with explicit instructions, not deferred logic.
- **Type consistency:** `FighterImageProps` used identically in T2/T4/T5; `fighterIdByName` signature identical in T1 and T5; `import.meta.env.BASE_URL` src form used everywhere; avatar fallback keeps `aria-label="${name} portrait"` while photo uses `alt="${name}"` + `data-testid="fighter-photo"` — tests target the right one.
- **Determinism / constraints:** no `Math.random`, no new deps, TS strict — all enforced in T6 gate.
