# M16 — Full Ground Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace M15's interim single-decision takedown routing with a full playable ground tree — choose a takedown TYPE (single-leg/double-leg/trip/body-lock) that lands you in a POSITION (guard→half-guard→side-control→mount→back), then each ground beat pick Ground & Pound / Advance / Submission (submission gated by position), while the opponent resists (hold/escape).

**Architecture:** A landed **player** takedown now enters a new `'ground'` FightPhase carrying a `GroundState { position }`, resolved beat-by-beat by a new pure `resolveGround(state, action)` that shares the round's 3-beat exchange budget and the existing round-boundary stamina economy (extracted from `resolveExchange`). Ground actions credit `roundScore` (judges only read roundScore), reuse the finish-window machinery for a G&P rock (KO) and finish immediately on a successful submission (tap). **Opponent** takedowns deliberately keep M15 behavior (finish-window defense / round-advance) — a playable bottom game is out of scope. Balance is re-derived empirically; the ground game must **not** dominate striking.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind; Vitest + React Testing Library; seeded RNG via `createRng` (no `Math.random`); localStorage persistence (`runStorageV2`).

## Global Constraints

- **No `Math.random`, no `Date` in game logic.** Every random draw flows through `createRng(seedKey)`. Ground seed key: `` `${seed}#f${fightNumber}#r${round}#g${exchange}` `` (distinct `#g` namespace from strike `#x` and AI `#ai...#x`).
- **Determinism is a gate.** `npx vitest run` twice must produce byte-identical counts; the balance table must be reproducible.
- **No new dependencies.** `package.json` / `package-lock.json` must be byte-identical to `origin/main` at the end (`git diff --stat origin/main -- package.json package-lock.json` empty).
- **Strict TypeScript.** `npx tsc --noEmit` clean at the end of every task (except the two explicitly COUPLED tasks T3/T6, which are green only at the task's END — intermediate steps within the task may not typecheck; the squash-merge hides it).
- **Balance bands are load-bearing and may never be weakened.** The six M15 bands (values below) must hold at PLAN strength after re-derivation. If a NEW ground knob is needed to hold a band, tune the NEW knob — never lower a band constant.
- **Every commit** trailered exactly:
  ```
  Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
  Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d
  ```
- **Push after every commit; verify `git rev-parse HEAD == @{u}`.** Report any push failure immediately.
- **One PR** titled `M16: full ground tree` into `main`. **Do NOT merge. Do NOT deploy.** Report back.
- **Scope:** `src/domain/combat/**`, `src/persistence/runStorageV2.*`, `src/components/GroundPanel.*`, `src/components/StrikePanel.*`, `src/screens/FightView.*`, `src/App.*`, `src/fightDisplay.*`, `docs/superpowers/**`. No roster/draft/stat-model/archetype-table changes. `StatLine` stays exactly 9 stats (draft + persistence depend on it — do NOT add a scramble stat).

### The six balance bands (M15 T7 — re-derive, never weaken)

Harness: 300 seeds, player = `buildStatLine(getFighter('georges-st-pierre'))`, fightNumbers 1..10, `generateOpponent(seed, fightNumber)`.

- **B1** aggregate good finish rate `AGG_FINISH_FLOOR = 0.55` (M15 measured 0.6573)
- **B2** `FIGHT1_GAP_FLOOR = 0.45` (good@1 − careless@1) **AND** careless@1 ≤ 0.72 **AND** `FIGHT1_GOOD_WINRATE_FLOOR = 0.90` (good@1)
- **B3** `GOOD_FLOOR_LATE = 0.45` (good@9 and good@10)
- **B4** good winRate > careless winRate for every fight 1..10
- **B5** `CARELESS_CEILING_LATE = 0.42` (careless@9 and careless@10 — head-hunt spam stays dead)
- **B6** `RAMP_BUFFER = 0.12` (good/careless winRate[n+1] ≤ winRate[n] + buffer) with the ONE documented fight-2→3 dip (`DIPTIER2TO3_GOOD = 0.24`, `DIPTIER2TO3_CARELESS = 0.36`)
- **NEW B7 (M16)** ground must not dominate striking — a ground-heavy exploit policy must not exceed a documented late-tier ceiling (defined in T8).

---

## File Structure

**New files (domain):**
- `src/domain/combat/ground.ts` — position/action/submission types + `POSITION_LADDER`, `POSITION_QUALITY`, `nextPosition`, `POSITION_SUBMISSION`, labels. **(T1)**
- `src/domain/combat/takedown.ts` — `TakedownType`, `TAKEDOWN_PROFILES`, `opponentTakedownType`, labels/blurbs. **(T2)**
- `src/domain/combat/groundEngine.ts` — pure ground math: `groundPoundDamage`, `groundSubProbability`, `advanceProbability`, `escapeProbability` + cost constants. **(T4)**
- `src/domain/combat/groundResolve.ts` — `resolveGround(state, action)`. **(T6)**

**Modified files (domain):**
- `intents.ts` — `ExchangeMove` takedown variant gains `takedownType`. **(T3)**
- `fightState.ts` — `FightPhase` (`ground-window`→`ground`), `FinishWindow.method` (drop `ground`), `FightState.ground`, `startFight`, `opponentMove` (derive `takedownType`). **(T3, T6)**
- `exchange.ts` — extract `crossRoundBoundary` to module scope; rewire player-takedown branch to enter `'ground'`; per-type takedown atk/cost. **(T6)**
- `finish.ts` — retire `groundStep`; remove the dead `method === 'ground'` guard in `finishStep`. **(T6)**
- `report.ts` — add `buildGroundReport`. **(T5)**
- `index.ts` — barrel: `export *` the 4 new modules. **(T1, T2, T4, T6)**

**Modified files (persistence / UI):**
- `runStorageV2.ts` — schema v5, `ground` field + `'ground'` phase invariant. **(T7)**
- `StrikePanel.tsx` — takedown-type sub-row. **(T3 stopgap, T9 real)**
- `GroundPanel.tsx` — position-aware rewrite. **(T9)**
- `FightView.tsx` — `onGroundAction`, `'ground'` phase render. **(T10)**
- `App.tsx` — `handleGroundAction` + `resolveGround`. **(T10)**
- `fightDisplay.ts` — `roundLabel` `'ground'` case. **(T10)**

**Coupled test sweep (updated inside the task that breaks them):** `exchange.test.ts`, `finish.test.ts`, `intents.test.ts`, `integration.test.ts`, `balance.test.ts`, `e2e.resume.test.tsx`, `App.test.tsx`, `runStorageV2.test.ts`, `StrikePanel.test.tsx`, `GroundPanel.test.tsx`, `FightView.test.tsx`, `fightDisplay.test.ts`.

---

## Task Dependency Graph

```
T1 ground.ts ─┐
T2 takedown.ts┼─► T3 retype ─┐
              │              │
              ├─► T4 groundEngine ─┐
              └─► T5 buildGroundReport ─┤
                                       ├─► T6 engine (resolveGround + 'ground' phase) ─┬─► T7 persistence ─┐
                                       │                                                ├─► T8 balance GATE ─┼─► T10 wire + gate + dev-look
                                       │                                                └─► T9 UI ──────────┘
```
Safe parallelization: **T1 ∥ T2**; then **T4 ∥ T5** (both need T1/T2); T3 needs T1/T2. **T7 ∥ T8 ∥ T9** after T6. T10 last.

---

### Task 0: Commit design + plan docs

**Files:**
- Create: `docs/superpowers/specs/2026-07-16-immersive-fight-overhaul-design.md` (the epic design — M16 ground section is authoritative)
- Create: `docs/superpowers/plans/2026-07-16-m16-full-ground-tree.md` (this plan)

- [ ] **Step 1: Fetch both gist files** (URLs provided in the build-session kickoff) and write them verbatim to the paths above.
- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-16-immersive-fight-overhaul-design.md docs/superpowers/plans/2026-07-16-m16-full-ground-tree.md
git commit -m "docs(m16): full ground tree design + plan"
```

Expected: 2 files committed, trailer present. No source touched.

---

### Task 1: Ground position model (`ground.ts`)

**Files:**
- Create: `src/domain/combat/ground.ts`
- Test: `src/domain/combat/ground.test.ts`
- Modify: `src/domain/combat/index.ts` (add `export * from './ground';`)

**Interfaces:**
- Produces:
  - `type GroundPosition = 'guard' | 'half-guard' | 'side-control' | 'mount' | 'back'`
  - `type GroundAction = 'ground-and-pound' | 'advance' | 'submission'`
  - `type SubmissionType = 'kimura' | 'arm-triangle' | 'armbar' | 'rear-naked-choke'`
  - `interface GroundState { position: GroundPosition }`
  - `const POSITION_LADDER: readonly GroundPosition[]`
  - `const POSITION_QUALITY: Record<GroundPosition, number>` (guard 0 … back 4)
  - `function nextPosition(p: GroundPosition): GroundPosition | null` (back → null)
  - `const POSITION_SUBMISSION: Record<GroundPosition, SubmissionType | null>`
  - `const GROUND_ACTIONS: readonly GroundAction[]`
  - `const GROUND_ACTION_LABELS: Record<GroundAction, string>`
  - `const GROUND_POSITION_LABELS: Record<GroundPosition, string>`
  - `const SUBMISSION_LABELS: Record<SubmissionType, string>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/combat/ground.test.ts
import { describe, it, expect } from 'vitest';
import {
  POSITION_LADDER, POSITION_QUALITY, nextPosition, POSITION_SUBMISSION,
  GROUND_ACTIONS, type GroundPosition,
} from './ground';

describe('ground position model', () => {
  it('ladder is guard→half-guard→side-control→mount→back, quality strictly increasing', () => {
    expect(POSITION_LADDER).toEqual(['guard', 'half-guard', 'side-control', 'mount', 'back']);
    for (let i = 1; i < POSITION_LADDER.length; i++) {
      expect(POSITION_QUALITY[POSITION_LADDER[i]]).toBeGreaterThan(POSITION_QUALITY[POSITION_LADDER[i - 1]]);
    }
    expect(POSITION_QUALITY.guard).toBe(0);
    expect(POSITION_QUALITY.back).toBe(4);
  });

  it('nextPosition walks the ladder and dead-ends at back', () => {
    expect(nextPosition('guard')).toBe('half-guard');
    expect(nextPosition('side-control')).toBe('mount');
    expect(nextPosition('mount')).toBe('back');
    expect(nextPosition('back')).toBeNull();
  });

  it('submissions are gated by position: guard has none, back gives the RNC', () => {
    expect(POSITION_SUBMISSION.guard).toBeNull();
    expect(POSITION_SUBMISSION['half-guard']).toBe('kimura');
    expect(POSITION_SUBMISSION['side-control']).toBe('arm-triangle');
    expect(POSITION_SUBMISSION.mount).toBe('armbar');
    expect(POSITION_SUBMISSION.back).toBe('rear-naked-choke');
  });

  it('exposes the three ground actions', () => {
    expect(GROUND_ACTIONS).toEqual(['ground-and-pound', 'advance', 'submission']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/domain/combat/ground.test.ts` → FAIL (module not found).
- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/combat/ground.ts
export type GroundPosition = 'guard' | 'half-guard' | 'side-control' | 'mount' | 'back';
export type GroundAction = 'ground-and-pound' | 'advance' | 'submission';
export type SubmissionType = 'kimura' | 'arm-triangle' | 'armbar' | 'rear-naked-choke';

export interface GroundState {
  position: GroundPosition;
}

export const POSITION_LADDER: readonly GroundPosition[] = [
  'guard', 'half-guard', 'side-control', 'mount', 'back',
] as const;

export const POSITION_QUALITY: Record<GroundPosition, number> = {
  guard: 0, 'half-guard': 1, 'side-control': 2, mount: 3, back: 4,
};

export function nextPosition(p: GroundPosition): GroundPosition | null {
  const i = POSITION_LADDER.indexOf(p);
  return i >= 0 && i < POSITION_LADDER.length - 1 ? POSITION_LADDER[i + 1] : null;
}

/** Submission available FROM each position (null = none, e.g. neutral guard on top). */
export const POSITION_SUBMISSION: Record<GroundPosition, SubmissionType | null> = {
  guard: null,
  'half-guard': 'kimura',
  'side-control': 'arm-triangle',
  mount: 'armbar',
  back: 'rear-naked-choke',
};

export const GROUND_ACTIONS: readonly GroundAction[] = ['ground-and-pound', 'advance', 'submission'] as const;

export const GROUND_ACTION_LABELS: Record<GroundAction, string> = {
  'ground-and-pound': 'Ground & Pound',
  advance: 'Advance Position',
  submission: 'Submission',
};

export const GROUND_POSITION_LABELS: Record<GroundPosition, string> = {
  guard: 'In Guard',
  'half-guard': 'Half Guard',
  'side-control': 'Side Control',
  mount: 'Mount',
  back: 'Back Mount',
};

export const SUBMISSION_LABELS: Record<SubmissionType, string> = {
  kimura: 'Kimura',
  'arm-triangle': 'Arm-Triangle',
  armbar: 'Armbar',
  'rear-naked-choke': 'Rear-Naked Choke',
};
```

- [ ] **Step 4: Add barrel export** — in `src/domain/combat/index.ts` add `export * from './ground';` after `export * from './strikes';`.
- [ ] **Step 5: Run tests** — `npx vitest run src/domain/combat/ground.test.ts` → PASS; `npx tsc --noEmit` → clean.
- [ ] **Step 6: Commit** — `git commit -m "feat(combat): ground position model (ladder + submission gating)"`

---

### Task 2: Takedown types + profiles (`takedown.ts`)

**Files:**
- Create: `src/domain/combat/takedown.ts`
- Test: `src/domain/combat/takedown.test.ts`
- Modify: `src/domain/combat/index.ts` (add `export * from './takedown';`)

**Interfaces:**
- Consumes: `GroundPosition` (T1); `ArchetypeId` from `./archetypes`.
- Produces:
  - `type TakedownType = 'single-leg' | 'double-leg' | 'trip' | 'body-lock'`
  - `interface TakedownProfile { atkMult: number; cost: number; landsAt: GroundPosition }`
  - `const TAKEDOWN_PROFILES: Record<TakedownType, TakedownProfile>`
  - `const TAKEDOWN_TYPES: readonly TakedownType[]`
  - `const TAKEDOWN_LABELS: Record<TakedownType, string>`
  - `const TAKEDOWN_BLURBS: Record<TakedownType, string>`
  - `function opponentTakedownType(archetype: ArchetypeId): TakedownType` (pure — NO rng)

**Design (risk↔reward — higher `atkMult` lands more often but into a WORSE position; better position costs more and lands less):**

| type | atkMult | cost | landsAt |
|------|--------:|-----:|---------|
| single-leg | 1.30 | 14 | guard |
| double-leg | 1.20 | 17 | half-guard |
| trip | 1.10 | 12 | side-control |
| body-lock | 1.00 | 18 | mount |

(`double-leg` cost 17 == the retired flat `TAKEDOWN_COST`, so the AI default keeps stamina identical to M15 — see T3.)

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/combat/takedown.test.ts
import { describe, it, expect } from 'vitest';
import { TAKEDOWN_PROFILES, TAKEDOWN_TYPES, opponentTakedownType } from './takedown';

describe('takedown profiles', () => {
  it('four types with the risk/reward ordering: easier shot → weaker landing position', () => {
    expect(TAKEDOWN_TYPES).toEqual(['single-leg', 'double-leg', 'trip', 'body-lock']);
    // higher atkMult = easier to land = weaker position quality
    expect(TAKEDOWN_PROFILES['single-leg'].atkMult).toBeGreaterThan(TAKEDOWN_PROFILES['body-lock'].atkMult);
    expect(TAKEDOWN_PROFILES['single-leg'].landsAt).toBe('guard');
    expect(TAKEDOWN_PROFILES['body-lock'].landsAt).toBe('mount');
    expect(TAKEDOWN_PROFILES['double-leg'].landsAt).toBe('half-guard');
    expect(TAKEDOWN_PROFILES['trip'].landsAt).toBe('side-control');
  });

  it('double-leg cost equals the retired flat takedown cost (17) — AI default is stamina-neutral vs M15', () => {
    expect(TAKEDOWN_PROFILES['double-leg'].cost).toBe(17);
  });

  it('opponentTakedownType is a pure, total map over archetypes', () => {
    expect(opponentTakedownType('wrestler')).toBe('double-leg');
    expect(opponentTakedownType('grappler')).toBe('trip');
    expect(opponentTakedownType('brawler')).toBe('single-leg');
    expect(opponentTakedownType('striker')).toBe('single-leg');
    expect(opponentTakedownType('allrounder')).toBe('double-leg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — FAIL (module not found).
- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/combat/takedown.ts
import type { GroundPosition } from './ground';
import type { ArchetypeId } from './archetypes';

export type TakedownType = 'single-leg' | 'double-leg' | 'trip' | 'body-lock';

export interface TakedownProfile {
  /** Offensive multiplier on the shooter's takedowns score (replaces flat TAKEDOWN_ATK). */
  atkMult: number;
  /** Per-beat stamina charged to shoot. */
  cost: number;
  /** Position secured on a successful shot. */
  landsAt: GroundPosition;
}

// Starting values — TUNED IN T6/T8. Risk/reward: easier shot → weaker position.
export const TAKEDOWN_PROFILES: Record<TakedownType, TakedownProfile> = {
  'single-leg': { atkMult: 1.30, cost: 14, landsAt: 'guard' },
  'double-leg': { atkMult: 1.20, cost: 17, landsAt: 'half-guard' },
  'trip':       { atkMult: 1.10, cost: 12, landsAt: 'side-control' },
  'body-lock':  { atkMult: 1.00, cost: 18, landsAt: 'mount' },
};

export const TAKEDOWN_TYPES: readonly TakedownType[] = ['single-leg', 'double-leg', 'trip', 'body-lock'] as const;

export const TAKEDOWN_LABELS: Record<TakedownType, string> = {
  'single-leg': 'Single Leg',
  'double-leg': 'Double Leg',
  'trip': 'Trip',
  'body-lock': 'Body Lock',
};

export const TAKEDOWN_BLURBS: Record<TakedownType, string> = {
  'single-leg': 'Quick shot — lands often, but only into guard.',
  'double-leg': 'Drive through — reliable, into half guard.',
  'trip': 'Off-balance him — sneaky, straight to side control.',
  'body-lock': 'Muscle him down — hard to land, but you take mount.',
};

/** Deterministic archetype → preferred takedown. PURE (no rng) so the seeded
 *  stream is unchanged when opponentMove threads a takedownType (T3). */
export function opponentTakedownType(archetype: ArchetypeId): TakedownType {
  switch (archetype) {
    case 'wrestler': return 'double-leg';
    case 'grappler': return 'trip';
    case 'brawler': return 'single-leg';
    case 'striker': return 'single-leg';
    case 'allrounder': return 'double-leg';
    default: return 'double-leg';
  }
}
```

- [ ] **Step 4: Add barrel export** — `export * from './takedown';` in `index.ts`.
- [ ] **Step 5: Run tests** — `npx vitest run src/domain/combat/takedown.test.ts` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit** — `git commit -m "feat(combat): takedown types + profiles + archetype preference"`

---

### Task 3: Thread `takedownType` through `ExchangeMove` (COUPLED retype — behavior-preserving)

**This task extends a union member used across ~14 sites. It is behavior-preserving: the new field is INERT in the engine until T6 (atkMult/cost stay flat). Numbers must be byte-identical — determinism ×2 + existing golden tests prove it. The task is green only at its END (intermediate steps may not typecheck).**

**Files:**
- Modify: `src/domain/combat/intents.ts:45` — the union member.
- Modify: `src/domain/combat/fightState.ts:168` — `opponentMove` derives `takedownType`.
- Modify: `src/components/StrikePanel.tsx:61` — emit a default `takedownType` (real sub-row in T9).
- Sweep (tests — update the literal `{ kind: 'takedown' }` → `{ kind: 'takedown', takedownType: 'double-leg' }`):
  `exchange.test.ts:98`, `finish.test.ts:189`, `intents.test.ts:50`, `balance.test.ts:37`,
  `integration.test.ts:152,179,213,214,228,229`, `e2e.resume.test.tsx:36`, `runStorageV2.test.ts:32`,
  `StrikePanel.test.tsx:29` (expected arg → `{ kind: 'takedown', takedownType: 'double-leg' }`).

**Interfaces:**
- Consumes: `TakedownType`, `opponentTakedownType` (T2).
- Produces: `ExchangeMove` takedown variant `{ kind: 'takedown'; takedownType: TakedownType }`. `isTakedown` narrows to it unchanged.

- [ ] **Step 1: Write the failing test** (proves the field is threaded AND inert)

```typescript
// append to src/domain/combat/intents.test.ts
import { opponentTakedownType } from './takedown';

it('M16: takedown ExchangeMove carries a takedownType', () => {
  const m: ExchangeMove = { kind: 'takedown', takedownType: 'single-leg' };
  expect(isTakedown(m)).toBe(true);
  if (isTakedown(m)) expect(m.takedownType).toBe('single-leg');
});
```

```typescript
// append to src/domain/combat/fightState.test.ts  (or exchange.test.ts if opponentMove is exercised there)
import { opponentTakedownType } from './takedown';

it('M16: opponentMove tags takedowns with the archetype-preferred type (no extra rng draw)', () => {
  // Build a state whose opponent strongly prefers wrestling so opponentMove picks a takedown.
  const st = startFight({
    seed: 'td-type-seed', fightNumber: 1,
    playerStatLine: buildStatLine(getFighter('georges-st-pierre')),
    opponent: generateOpponent('td-type-seed', 4), // a wrestler-heavy tier
  });
  const mv = opponentMove(st);
  if (mv.kind === 'takedown') {
    expect(mv.takedownType).toBe(opponentTakedownType(st.opponent.archetype));
  }
});
```

- [ ] **Step 2: Run** — FAIL (type error: `takedownType` missing / not on the union).
- [ ] **Step 3: Extend the union** (`intents.ts:45`)

```typescript
// BEFORE
//   | { kind: 'takedown' };
// AFTER
import type { TakedownType } from './takedown';
// ...
export type ExchangeMove =
  | { kind: 'strike'; strike: StrikeId }
  | { kind: 'takedown'; takedownType: TakedownType };
```

- [ ] **Step 4: Thread `opponentMove`** (`fightState.ts:168`)

```typescript
// BEFORE:  if (wrestleEdge > strikeEdge) return { kind: 'takedown' };
// AFTER:
import { opponentTakedownType } from './takedown';
// ...
if (wrestleEdge > strikeEdge) {
  return { kind: 'takedown', takedownType: opponentTakedownType(state.opponent.archetype as ArchetypeId) };
}
```
(`state.opponent.archetype` is `ArchetypeId` on `Opponent`; if typed as `string` here, import `ArchetypeId` and cast as shown. NO `rng()` call is added — the stream is byte-identical.)

- [ ] **Step 5: StrikePanel stopgap** (`StrikePanel.tsx:61`) — keep it compiling with the AI-default type (T9 replaces with the real 4-button sub-row):

```tsx
onClick={() => onMove({ kind: 'takedown', takedownType: 'double-leg' })}
```

- [ ] **Step 6: Sweep every remaining literal** listed in **Files** above from `{ kind: 'takedown' }` → `{ kind: 'takedown', takedownType: 'double-leg' }`. In `StrikePanel.test.tsx:29`, update the expected argument to match Step 5.

- [ ] **Step 7: Run the FULL gate** — `npx vitest run` (all files) → PASS with **the same test count as M15 HEAD** (no numeric drift); `npx tsc --noEmit` clean; run vitest a **second** time → identical counts. Confirm no combat number changed (the `takedownType` is inert): `git stash` the change is NOT an option — instead assert the pre-existing determinism/golden tests (integration.test.ts GnP/sub A===B, exchange/resolve goldens) still pass unmodified except for the swept literal.

- [ ] **Step 8: Commit** — `git commit -m "refactor(combat): thread takedownType through ExchangeMove (inert, behavior-preserving)"`

---

### Task 4: Ground math (`groundEngine.ts`)

**Files:**
- Create: `src/domain/combat/groundEngine.ts`
- Test: `src/domain/combat/groundEngine.test.ts`
- Modify: `index.ts` (`export * from './groundEngine';`)

**Interfaces:**
- Consumes: `StatLine` (`./stats`); `GroundPosition`, `POSITION_QUALITY`, `POSITION_SUBMISSION` (T1); reusable `groundAndPoundDamage(attacker: StatLine, defender: StatLine): number` and `submissionTapProbability(attacker: StatLine, defender: StatLine): number` from `./finish`.
- Produces:
  - `function groundPoundDamage(attacker: StatLine, defender: StatLine, position: GroundPosition): number`
  - `function groundSubProbability(attacker: StatLine, defender: StatLine, position: GroundPosition, defenderGassed: boolean): number` (0 if no submission at that position)
  - `function advanceProbability(attacker: StatLine, defender: StatLine): number`
  - `function escapeProbability(attacker: StatLine, defender: StatLine): number`
  - cost consts: `GND_POUND_COST = 6`, `GND_ADVANCE_COST = 8`, `GND_SUBFAIL_COST = 12`
  - tuning consts (named, so T8 tunes by name): `GNP_POSITION_SCALE = 0.35`, `SUB_POSITION_SCALE = 0.10`, `SUB_GAS_BONUS = 0.10`, `ADVANCE_BASE = 0.55`, `ADVANCE_SCALE = 0.006`, `ADVANCE_MIN = 0.15`, `ADVANCE_MAX = 0.90`, `ESCAPE_BASE = 0.30`, `ESCAPE_SCALE = 0.006`, `ESCAPE_MIN = 0.05`, `ESCAPE_MAX = 0.60`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/combat/groundEngine.test.ts
import { describe, it, expect } from 'vitest';
import { groundPoundDamage, groundSubProbability, advanceProbability, escapeProbability } from './groundEngine';
import { groundAndPoundDamage } from './finish';
import type { StatLine } from './stats';

const strong: StatLine = { striking: 80, strikingDef: 75, takedowns: 85, takedownDef: 82, submissions: 82, submissionDef: 80, cardio: 78, chin: 70, fightIQ: 78 };
const weak: StatLine   = { striking: 40, strikingDef: 42, takedowns: 38, takedownDef: 40, submissions: 40, submissionDef: 42, cardio: 45, chin: 50, fightIQ: 44 };

describe('ground math', () => {
  it('G&P scales up with position quality (mount hits harder than guard)', () => {
    const base = groundAndPoundDamage(strong, weak);
    expect(groundPoundDamage(strong, weak, 'guard')).toBe(base); // quality 0 → ×1
    expect(groundPoundDamage(strong, weak, 'mount')).toBeGreaterThan(groundPoundDamage(strong, weak, 'guard'));
    expect(groundPoundDamage(strong, weak, 'back')).toBeGreaterThan(groundPoundDamage(strong, weak, 'mount'));
  });

  it('submission probability is 0 in neutral guard, rises with position and a gassed defender, clamped ≤0.95', () => {
    expect(groundSubProbability(strong, weak, 'guard', false)).toBe(0);
    const dry = groundSubProbability(strong, weak, 'back', false);
    const gassed = groundSubProbability(strong, weak, 'back', true);
    expect(gassed).toBeGreaterThan(dry);
    expect(groundSubProbability(strong, weak, 'mount', false))
      .toBeGreaterThan(groundSubProbability(strong, weak, 'half-guard', false));
    expect(gassed).toBeLessThanOrEqual(0.95);
  });

  it('advance favors the better wrestler; escape favors the better defensive wrestler; both clamped', () => {
    expect(advanceProbability(strong, weak)).toBeGreaterThan(advanceProbability(weak, strong));
    expect(advanceProbability(strong, weak)).toBeLessThanOrEqual(0.90);
    expect(advanceProbability(weak, strong)).toBeGreaterThanOrEqual(0.15);
    expect(escapeProbability(weak, strong)).toBeGreaterThan(escapeProbability(strong, weak));
    expect(escapeProbability(weak, strong)).toBeLessThanOrEqual(0.60);
    expect(escapeProbability(strong, weak)).toBeGreaterThanOrEqual(0.05);
  });
});
```

- [ ] **Step 2: Run** — FAIL (module not found).
- [ ] **Step 3: Implement**

```typescript
// src/domain/combat/groundEngine.ts
import type { StatLine } from './stats';
import type { GroundPosition } from './ground';
import { POSITION_QUALITY, POSITION_SUBMISSION } from './ground';
import { groundAndPoundDamage, submissionTapProbability } from './finish';

export const GNP_POSITION_SCALE = 0.35;
export const SUB_POSITION_SCALE = 0.10;
export const SUB_GAS_BONUS = 0.10;
export const ADVANCE_BASE = 0.55;
export const ADVANCE_SCALE = 0.006;
export const ADVANCE_MIN = 0.15;
export const ADVANCE_MAX = 0.90;
export const ESCAPE_BASE = 0.30;
export const ESCAPE_SCALE = 0.006;
export const ESCAPE_MIN = 0.05;
export const ESCAPE_MAX = 0.60;

export const GND_POUND_COST = 6;
export const GND_ADVANCE_COST = 8;
export const GND_SUBFAIL_COST = 12;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function groundPoundDamage(attacker: StatLine, defender: StatLine, position: GroundPosition): number {
  const base = groundAndPoundDamage(attacker, defender);
  return Math.round(base * (1 + GNP_POSITION_SCALE * POSITION_QUALITY[position]));
}

export function groundSubProbability(
  attacker: StatLine, defender: StatLine, position: GroundPosition, defenderGassed: boolean,
): number {
  if (POSITION_SUBMISSION[position] === null) return 0;
  const p = submissionTapProbability(attacker, defender)
    + SUB_POSITION_SCALE * POSITION_QUALITY[position]
    + (defenderGassed ? SUB_GAS_BONUS : 0);
  return clamp(p, 0.05, 0.95);
}

export function advanceProbability(attacker: StatLine, defender: StatLine): number {
  return clamp(ADVANCE_BASE + (attacker.takedowns - defender.takedownDef) * ADVANCE_SCALE, ADVANCE_MIN, ADVANCE_MAX);
}

export function escapeProbability(attacker: StatLine, defender: StatLine): number {
  // attacker = TOP player; defender = BOTTOM opponent trying to get up.
  return clamp(ESCAPE_BASE + (defender.takedownDef - attacker.takedowns) * ESCAPE_SCALE, ESCAPE_MIN, ESCAPE_MAX);
}
```

- [ ] **Step 4: Barrel** — `export * from './groundEngine';`
- [ ] **Step 5: Run** — `npx vitest run src/domain/combat/groundEngine.test.ts` PASS; `tsc --noEmit` clean.
- [ ] **Step 6: Commit** — `git commit -m "feat(combat): ground math (position-scaled G&P, sub, advance, escape)"`

---

### Task 5: Ground round report (`buildGroundReport`)

**Files:**
- Modify: `src/domain/combat/report.ts` (add `buildGroundReport`)
- Test: `src/domain/combat/report.test.ts` (append)

**Interfaces:**
- Consumes: existing `RoundReport` shape `{ round, headline, detail, winner, playerHeadDelta, playerBodyDelta, opponentHeadDelta, opponentBodyDelta }`; `GroundAction`, `GroundPosition`, `GROUND_POSITION_LABELS`, `SUBMISSION_LABELS`, `POSITION_SUBMISSION` (T1); `SubmissionType`.
- Produces:
  - `interface GroundReportInput { round: number; action: GroundAction; position: GroundPosition; success: boolean; opponentHeadDelta: number; escaped: boolean; submitted: boolean; }`
  - `function buildGroundReport(input: GroundReportInput): RoundReport` (winner always `'player'` since only the player plays top; deltas map onto `opponentHeadDelta`)

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/domain/combat/report.test.ts
import { buildGroundReport } from './report';

describe('buildGroundReport', () => {
  it('narrates a submission tap as the headline', () => {
    const r = buildGroundReport({ round: 2, action: 'submission', position: 'back', success: true, opponentHeadDelta: 0, escaped: false, submitted: true });
    expect(r.headline.toLowerCase()).toContain('rear-naked choke');
    expect(r.winner).toBe('player');
  });
  it('narrates an advance and an escape distinctly', () => {
    const adv = buildGroundReport({ round: 1, action: 'advance', position: 'mount', success: true, opponentHeadDelta: 0, escaped: false, submitted: false });
    expect(adv.headline.toLowerCase()).toContain('mount');
    const esc = buildGroundReport({ round: 1, action: 'ground-and-pound', position: 'side-control', success: true, opponentHeadDelta: 12, escaped: true, submitted: false });
    expect(esc.detail.toLowerCase()).toContain('escap');
    expect(esc.opponentHeadDelta).toBe(12);
  });
});
```

- [ ] **Step 2: Run** — FAIL (`buildGroundReport` not exported).
- [ ] **Step 3: Implement** (append to `report.ts`)

```typescript
import type { GroundAction, GroundPosition } from './ground';
import { GROUND_POSITION_LABELS, POSITION_SUBMISSION, SUBMISSION_LABELS } from './ground';

export interface GroundReportInput {
  round: number;
  action: GroundAction;
  position: GroundPosition;   // position AFTER the action resolved
  success: boolean;
  opponentHeadDelta: number;
  escaped: boolean;
  submitted: boolean;
}

export function buildGroundReport(input: GroundReportInput): RoundReport {
  const posLabel = GROUND_POSITION_LABELS[input.position];
  let headline: string;
  let detail: string;

  if (input.submitted) {
    const sub = POSITION_SUBMISSION[input.position];
    headline = sub ? `Tap! ${SUBMISSION_LABELS[sub]} from ${posLabel}.` : `Submission from ${posLabel}.`;
    detail = 'The opponent taps — it is over.';
  } else if (input.action === 'submission') {
    headline = `Submission attempt from ${posLabel}.`;
    detail = 'He defends and works free of the hold.';
  } else if (input.action === 'advance') {
    headline = input.success ? `Advanced to ${posLabel}.` : `Stuffed advancing from ${posLabel}.`;
    detail = input.success ? 'Better position, more control.' : 'He frames and denies the pass.';
  } else {
    headline = `Ground & pound from ${posLabel}.`;
    detail = input.opponentHeadDelta > 0 ? `Heavy shots land — ${input.opponentHeadDelta} damage.` : 'He covers up.';
  }
  if (input.escaped) detail += ' The opponent scrambles up and escapes to the feet.';

  return {
    round: input.round,
    headline,
    detail,
    winner: 'player',
    playerHeadDelta: 0,
    playerBodyDelta: 0,
    opponentHeadDelta: input.opponentHeadDelta,
    opponentBodyDelta: 0,
  };
}
```

- [ ] **Step 4: Run** — PASS; `tsc --noEmit` clean. (report.ts is imported directly, not via barrel — no barrel change.)
- [ ] **Step 5: Commit** — `git commit -m "feat(combat): ground round report narration"`

---

### Task 6: Engine — `'ground'` phase + `resolveGround` (COUPLED; green only at END)

**The heart of M16.** Extracts the round-boundary economy so the ground resolver can reuse it, retypes the phase model, rewrites the player-takedown branch to enter a real `'ground'` phase, adds `resolveGround`, retires `groundStep`, and sweeps every coupled test. **Intermediate steps will not typecheck; the FULL gate must be green at the END of this task.** T6 may tune ONLY new ground knobs (`TAKEDOWN_PROFILES`, `groundEngine` consts) to keep bands green with an interim harness policy — it must **never** touch a band constant. T8 does the real re-derivation.

**Files:**
- Modify: `src/domain/combat/exchange.ts` — extract+export `crossRoundBoundary`; per-type takedown atk/cost; delete `TAKEDOWN_ATK`/`TAKEDOWN_COST`; rewrite player-takedown branch (L181-198).
- Modify: `src/domain/combat/fightState.ts` — `FightPhase` (`'ground-window'`→`'ground'`), `FinishWindow.method` (drop `'ground'`), `FightState.ground: GroundState | null`, `startFight` inits `ground: null`.
- Modify: `src/domain/combat/finish.ts` — delete `groundStep` (L238-end of fn) and its now-unused imports; delete the dead `win.method === 'ground'` guard in `finishStep` (L158-160).
- Create: `src/domain/combat/groundResolve.ts` — `resolveGround`.
- Test: `src/domain/combat/groundResolve.test.ts` — new behavior.
- Modify barrel `index.ts` — `export * from './groundResolve';`.
- Sweep coupled tests (mechanical `'ground-window'`→`'ground'`, `groundStep`→`resolveGround`, `method:'ground'` removed): `exchange.test.ts`, `finish.test.ts` (delete groundStep tests), `integration.test.ts` (L152,179,213-229), `e2e.resume.test.tsx` (L36+), `runStorageV2.test.ts` (L32+ — schema touched fully in T7, but keep it compiling here), `balance.test.ts` (interim `'ground'` routing — full rewrite in T8), `App.test.tsx` (ground flow — full wiring in T10, keep compiling here).

**Interfaces:**
- Consumes: `GroundState`, `GroundAction`, `nextPosition`, `POSITION_SUBMISSION` (T1); `TAKEDOWN_PROFILES` (T2); ground math + costs (T4); `buildGroundReport` (T5); existing `crossRoundBoundary` (now exported), `EXCHANGES_PER_ROUND`, `ROCKED_HEAD_DMG`, `INITIAL_STEPS`, `scoreFight`, `gamePlanEffect`, `isGassed`, `clampStamina`.
- Produces: `function resolveGround(state: FightState, action: GroundAction): FightState`; exported `crossRoundBoundary(state, p, o, planStaminaDelta, log): FightState`.

#### Step 1: Extract `crossRoundBoundary` to module scope (behavior-preserving refactor)

Currently a closure at `exchange.ts:164-179` capturing `state`, `plan`, `logEntry`. Lift it out of `resolveExchange` to module scope with an explicit signature. **Guarded by the existing determinism/golden tests** — no number may change.

```typescript
// NEW module-level function in exchange.ts (place ABOVE resolveExchange).
// Opp is exchange.ts's local opponent type; export it too, or use FightState['opponent'].
export function crossRoundBoundary(
  state: FightState,
  p: Fighter2,
  o: FightState['opponent'],
  planStaminaDelta: number,
  log: RoundLogEntry[],
): FightState {
  const pRb = clampStamina(
    p.stamina + recovery(state.player.statLine) - bodyRecoveryPenalty(p.bodyDamage) + planStaminaDelta,
  );
  const oRb = clampStamina(
    o.stamina + recovery(state.opponent.statLine) - bodyRecoveryPenalty(o.bodyDamage),
  );
  const p2: Fighter2 = { ...p, stamina: pRb };
  const o2: FightState['opponent'] = { ...o, stamina: oRb };
  const base = { ...state, player: p2, opponent: o2, log };
  if (state.round >= state.rounds) {
    const finalBase: FightState = { ...base, exchange: state.exchange, phase: 'finished', window: null, gamePlan: null, outcome: null };
    return { ...finalBase, outcome: scoreFight(finalBase) };
  }
  return { ...base, exchange: 1, round: state.round + 1, phase: 'corner', window: null, gamePlan: null, outcome: null };
}
```

Inside `resolveExchange`, delete the old closure and update its **one** call site (the opponent no-rock path, L245) to:
```typescript
return { ...crossRoundBoundary(state, pGnp, oBase, plan.staminaDelta, [...state.log, logEntry]), lastReport: report };
```
**Also add `export` to the local `clampStamina` at `exchange.ts:38`** (`export function clampStamina(...)`) — `groundResolve.ts` (Step 5) reuses it. `clampStamina` currently lives in `exchange.ts` (NOT `stamina.ts`); do not create a duplicate.
Run `npx vitest run src/domain/combat` → **all green, unchanged counts** (pure refactor). Commit: `refactor(combat): extract crossRoundBoundary to module scope`.

#### Step 2: Per-type takedown atk/cost; delete flat constants

`atkMult` helper (exchange.ts ~L48):
```typescript
// BEFORE: return move.kind === 'strike' ? STRIKES[move.strike].atkMult : TAKEDOWN_ATK;
// AFTER:
import { TAKEDOWN_PROFILES } from './takedown';
function atkMult(move: ExchangeMove): number {
  return move.kind === 'strike' ? STRIKES[move.strike].atkMult : TAKEDOWN_PROFILES[move.takedownType].atkMult;
}
```
Costs (L139-140):
```typescript
const pCost = playerMove.kind === 'strike' ? STRIKES[playerMove.strike].staminaCost : TAKEDOWN_PROFILES[playerMove.takedownType].cost;
const oCost = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].staminaCost : TAKEDOWN_PROFILES[oppMove.takedownType].cost;
```
Delete `TAKEDOWN_ATK` and `TAKEDOWN_COST` consts (now unused). Leave `TAKEDOWN_VS_STRIKE_DEF` and `defMult` untouched (defense is type-agnostic).

**Numbers change now** (single-leg 1.30 / double-leg 1.20 / trip 1.10 / body-lock 1.00 vs the old flat 1.25; costs per-type). The AI defaults to `double-leg` (1.20/17) — close to old 1.25/17 but not identical. This is expected; balance is re-gated in T8, and T6 keeps bands green with the interim harness policy (Step 8). Existing exchange/integration golden tests that asserted exact post-takedown numbers must be updated to the new per-type values (recompute, don't weaken).

#### Step 3: Phase + state model (`fightState.ts`)

```typescript
import type { GroundState } from './ground';

export type FightPhase = 'in-round' | 'corner' | 'finish-window' | 'ground' | 'finished';
//                                          ^ 'ground-window' REMOVED, 'ground' ADDED

export interface FinishWindow {
  side: 'player' | 'opponent';
  method: 'KO' | 'submission';   // 'ground' REMOVED
  stepsLeft: number;
}

export interface FightState {
  // ...all existing fields unchanged...
  ground: GroundState | null;    // NEW — non-null only while phase === 'ground'
}
```
In `startFight(...)`, add `ground: null` to the returned object.

#### Step 4: Rewrite the player-takedown branch (`exchange.ts` L181-198)

Replace the whole `if (dominance > 0 && playerMove.kind === 'takedown') { ... }` block with:

```typescript
// ── Player takedown lands (dominance > 0) → enter the ground phase ──
if (dominance > 0 && playerMove.kind === 'takedown') {
  const profile = TAKEDOWN_PROFILES[playerMove.takedownType];
  const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - pCost), roundScore: state.player.roundScore + 1 + margin };
  const o: FightState['opponent'] = { ...state.opponent, stamina: clampStamina(state.opponent.stamina - oCost) };
  const report = makeReport(state.round, 'player', dominance, playerMove, oppMove, state, p, o);
  const nextExchange = state.exchange + 1;
  const logNow = [...state.log, logEntry];
  // The shot consumed this beat. If it was the last beat, the takedown still SCORES
  // but there are no ground beats this round → cross the round boundary (recovery applied).
  if (nextExchange > EXCHANGES_PER_ROUND) {
    return { ...crossRoundBoundary(state, p, o, plan.staminaDelta, logNow), lastReport: report };
  }
  // Otherwise enter the ground phase at the landed position; ground beats share the beat budget.
  return {
    ...state,
    phase: 'ground',
    exchange: nextExchange,
    ground: { position: profile.landsAt },
    window: null,
    gamePlan: null,
    lastReport: report,
    player: p,
    opponent: o,
    log: logNow,
  };
}
```
The opponent-takedown branch (L200-246) is **unchanged** (M15 behavior kept — scope cut).

**Stuffed-shot risk (design line 45) is already covered:** a player takedown that does NOT win the exchange (`dominance ≤ 0`) falls through past this branch to the strike-exchange branch (L248+) — the player eats the opponent's offense for that beat AND has paid the takedown stamina `pCost`. No extra code needed; note it for the reviewer so it isn't mistaken for a gap.

#### Step 5: New `resolveGround` (`groundResolve.ts`)

- [ ] **Write the failing tests first** (`groundResolve.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { startFight } from './fightState';
import { resolveExchange } from './exchange';
import { resolveGround } from './groundResolve';
import type { FightState } from './fightState';
import { buildStatLine, getFighter } from './roster';
import { generateOpponent } from './opponent';

// Drive a state into the ground phase via a landed player takedown.
function toGround(seed: string): FightState {
  let s = startFight({ seed, fightNumber: 1, playerStatLine: buildStatLine(getFighter('georges-st-pierre')), opponent: generateOpponent(seed, 1) });
  // Corner (round 1 has no corner) — startFight begins 'in-round'. Shoot until a takedown lands.
  // Use a wrestling-strong player + a seed known to land on beat 1 (choose during impl).
  s = resolveExchange(s, { kind: 'takedown', takedownType: 'double-leg' });
  return s;
}

describe('resolveGround', () => {
  it('a landed player takedown puts us in the ground phase with a position', () => {
    const s = toGround('ground-seed-A');
    expect(s.phase === 'ground' || s.phase === 'corner' || s.phase === 'finished').toBe(true);
    if (s.phase === 'ground') {
      expect(s.ground).not.toBeNull();
      expect(['guard','half-guard','side-control','mount','back']).toContain(s.ground!.position);
    }
  });

  it('throws if called off the ground phase', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: buildStatLine(getFighter('georges-st-pierre')), opponent: generateOpponent('x', 1) });
    expect(() => resolveGround(s, 'ground-and-pound')).toThrow();
  });

  it('is deterministic (same seed → identical result)', () => {
    const a = toGround('ground-seed-D'); const b = toGround('ground-seed-D');
    if (a.phase === 'ground' && b.phase === 'ground') {
      expect(resolveGround(a, 'ground-and-pound')).toEqual(resolveGround(b, 'ground-and-pound'));
    }
  });

  it('ground-and-pound credits roundScore and damages the opponent head (no rock)', () => {
    const s = toGround('ground-seed-B');
    if (s.phase === 'ground') {
      const r = resolveGround(s, 'ground-and-pound');
      // either stayed on ground / escaped to in-round / crossed to corner / opened a finish window
      expect(['ground','in-round','corner','finish-window','finished']).toContain(r.phase);
      // opponent head damage is monotonic non-decreasing
      expect(r.opponent.headDamage).toBeGreaterThanOrEqual(s.opponent.headDamage);
    }
  });

  it('advance from side-control can reach mount (better position quality)', () => {
    // Construct a ground state directly at side-control to isolate advance.
    const s0 = toGround('ground-seed-C');
    if (s0.phase === 'ground') {
      const s: FightState = { ...s0, ground: { position: 'side-control' }, exchange: 1 };
      const r = resolveGround(s, 'advance');
      if (r.phase === 'ground') {
        expect(['side-control','mount']).toContain(r.ground!.position);
      }
    }
  });

  it('a successful submission from the back finishes the fight by submission', () => {
    // Elite grappler vs weak defender at back → high sub probability; find a tapping seed in impl.
    const s0 = toGround('ground-seed-C');
    if (s0.phase === 'ground') {
      const s: FightState = { ...s0, ground: { position: 'back' } };
      const r = resolveGround(s, 'submission');
      expect(['finished','ground','in-round','corner']).toContain(r.phase);
      if (r.phase === 'finished') expect(r.outcome?.method).toBe('submission');
    }
  });
});
```
(During implementation, pick concrete seeds so the "tapping" / "beat-1 landing" assertions are exercised deterministically; tighten the `if` guards into unconditional asserts once seeds are chosen — no vacuous guards left in the committed test.)

- [ ] **Implement `resolveGround`** exactly:

```typescript
// src/domain/combat/groundResolve.ts
import type { FightState, Fighter2, RoundReport } from './fightState'; // RoundReport from report if needed
import { EXCHANGES_PER_ROUND, crossRoundBoundary, clampStamina } from './exchange'; // clampStamina lives in exchange.ts
import type { GroundAction, GroundPosition } from './ground';
import { nextPosition, POSITION_SUBMISSION } from './ground';
import {
  groundPoundDamage, groundSubProbability, advanceProbability, escapeProbability,
  GND_POUND_COST, GND_ADVANCE_COST, GND_SUBFAIL_COST,
} from './groundEngine';
import { ROCKED_HEAD_DMG, INITIAL_STEPS } from './finish';
import { buildGroundReport } from './report';
import { gamePlanEffect } from './gameplan';
import { isGassed } from './stamina';
import { createRng } from '../rng';

function settleGroundBeat(
  state: FightState,
  p: Fighter2,
  o: FightState['opponent'],
  position: GroundPosition,
  escaped: boolean,
  nextExchange: number,
  atBoundary: boolean,
  planStaminaDelta: number,
  report: ReturnType<typeof buildGroundReport>,
): FightState {
  if (atBoundary) {
    // End of the beat budget → normal round boundary (recovery applied), same economy as strikes.
    return { ...crossRoundBoundary(state, p, o, planStaminaDelta, state.log), ground: null, lastReport: report };
  }
  if (escaped) {
    // Opponent scrambles up → back to standing for the remaining beats of this round.
    return { ...state, phase: 'in-round', exchange: nextExchange, ground: null, window: null, player: p, opponent: o, lastReport: report };
  }
  // Stay on the ground for the next beat.
  return { ...state, phase: 'ground', exchange: nextExchange, ground: { position }, window: null, player: p, opponent: o, lastReport: report };
}

export function resolveGround(state: FightState, action: GroundAction): FightState {
  if (state.phase !== 'ground') {
    throw new Error(`resolveGround requires state.phase === "ground" (got "${state.phase}")`);
  }
  if (!state.ground) throw new Error('resolveGround requires state.ground to be set');

  const position = state.ground.position;
  const plan = gamePlanEffect(state.gamePlan);
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#g${state.exchange}`);

  // Player is always top in the ground phase (only player takedowns enter here — scope cut).
  const attacker = state.player;
  const defender = state.opponent;
  const defenderGassed = isGassed(defender.stamina);
  const nextExchange = state.exchange + 1;
  const atBoundary = nextExchange > EXCHANGES_PER_ROUND;
  const rollEscape = () => rng() < escapeProbability(attacker.statLine, defender.statLine);

  if (action === 'submission') {
    const chance = groundSubProbability(attacker.statLine, defender.statLine, position, defenderGassed);
    const roll = rng();
    if (POSITION_SUBMISSION[position] !== null && roll < chance) {
      const report = buildGroundReport({ round: state.round, action, position, success: true, opponentHeadDelta: 0, escaped: false, submitted: true });
      return { ...state, phase: 'finished', ground: null, window: null, lastReport: report, outcome: { winner: 'player', method: 'submission', round: state.round } };
    }
    const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - GND_SUBFAIL_COST) };
    const escaped = rollEscape();
    const report = buildGroundReport({ round: state.round, action, position, success: false, opponentHeadDelta: 0, escaped, submitted: false });
    return settleGroundBeat(state, p, state.opponent, position, escaped, nextExchange, atBoundary, plan.staminaDelta, report);
  }

  if (action === 'advance') {
    const np = nextPosition(position);
    let newPos = position; let scored = 0; let success = false;
    if (np === null) { success = true; scored = 1; }                // already at back → hold, score control
    else if (rng() < advanceProbability(attacker.statLine, defender.statLine)) { newPos = np; success = true; scored = 1; }
    const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - GND_ADVANCE_COST), roundScore: state.player.roundScore + scored };
    const escaped = rollEscape();
    const report = buildGroundReport({ round: state.round, action, position: newPos, success, opponentHeadDelta: 0, escaped, submitted: false });
    return settleGroundBeat(state, p, state.opponent, newPos, escaped, nextExchange, atBoundary, plan.staminaDelta, report);
  }

  // ground-and-pound
  const dmg = groundPoundDamage(attacker.statLine, defender.statLine, position);
  const preHead = defender.headDamage;
  const postHead = preHead + dmg;
  const rocked = ROCKED_HEAD_DMG(defender.statLine.chin);
  const o: FightState['opponent'] = { ...state.opponent, headDamage: postHead };
  const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - GND_POUND_COST), roundScore: state.player.roundScore + 1 };
  if (preHead < rocked && postHead >= rocked) {
    // Rock → reuse the KO finish window (player-side); leave the ground phase.
    const report = buildGroundReport({ round: state.round, action, position, success: true, opponentHeadDelta: dmg, escaped: false, submitted: false });
    return { ...state, phase: 'finish-window', ground: null, window: { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS }, gamePlan: null, lastReport: report, player: p, opponent: o };
  }
  const escaped = rollEscape();
  const report = buildGroundReport({ round: state.round, action, position, success: true, opponentHeadDelta: dmg, escaped, submitted: false });
  return settleGroundBeat(state, p, o, position, escaped, nextExchange, atBoundary, plan.staminaDelta, report);
}
```
(If `Fighter2`/`RoundReport` aren't exported from `fightState`, import `Fighter2` from wherever it's declared and drop the `RoundReport` import — `settleGroundBeat` uses `ReturnType<typeof buildGroundReport>`.)

Add `export * from './groundResolve';` to the barrel.

#### Step 6: Retire `groundStep`; delete `finishStep` dead guard (`finish.ts`)

- Delete the entire `groundStep` function (L238-end of the function).
- Delete the `if (win.method === 'ground') { throw ... }` guard (L158-160) in `finishStep` — `method` is now `'KO' | 'submission'` so it is unreachable dead code. `const method = win.method;` (L171) now already narrows correctly.
- Remove any imports left unused by the `groundStep` deletion (e.g. `GroundPlan`, `buildRoundReport` if only groundStep used them — check; `chooseGroundPlan`, `groundAndPoundDamage`, `submissionTapProbability` STAY, used by the opponent branch + groundEngine).

#### Step 7: Sweep the coupled tests
Mechanical transforms (enumerated sites from grep):
- `'ground-window'` → `'ground'` and assert `state.ground` (not `state.window`) after a landed **player** takedown: `exchange.test.ts`, `integration.test.ts` (L152, L179), `e2e.resume.test.tsx` (L36+), `runStorageV2.test.ts` (L32+).
- `integration.test.ts` L213-229 (GnP/sub determinism): the player-takedown now enters `'ground'`; replace the `groundStep(...)` calls with `resolveGround(..., 'ground-and-pound')` / `resolveGround(..., 'submission')` and keep the A===B determinism assertions.
- `finish.test.ts`: **delete** the groundStep describe blocks (incl. the "M14 fix: groundStep lastReport" tests) — that behavior is retired; ground coverage now lives in `groundResolve.test.ts`. Update L189's post-takedown assertion to `'ground'`.
- `App.test.tsx`: any `'ground-window'`/`groundStep` reference → `'ground'`/`resolveGround` (full wiring lands in T10; here just keep it compiling+green).

#### Step 8: Keep the balance harness green (interim policy)
`balance.test.ts`'s `playFight` currently routes `'ground-window'` via `groundStep`. Update it to route `'ground'` via `resolveGround` with a **simple interim policy** so the gate stays green:
```typescript
// interim ground policy inside playFight (T8 replaces with the tuned good/careless policies):
while (s.phase === 'ground') {
  const pos = s.ground!.position;
  const canSub = POSITION_SUBMISSION[pos] !== null;
  s = resolveGround(s, canSub ? 'submission' : 'advance');
}
```
Run the full balance suite. If a band dips, tune ONLY `TAKEDOWN_PROFILES` / `groundEngine` consts (never a band constant). Document any knob change in the commit body.

#### Step 9: Full gate + determinism ×2
`npx vitest run` (twice, identical counts) · `npx tsc --noEmit` clean · `npm run build` clean · `grep -rn 'Math.random(' src` → 0.

- [ ] **Commit** (may be several commits across steps 1–8; the coupled retype lands green at the end):
  `feat(combat): full ground phase + resolveGround (retire groundStep/ground-window)`

---

### Task 7: Persistence — schema v5 (`ground` field + `'ground'` phase invariant)

**Files:**
- Modify: `src/persistence/runStorageV2.ts`
- Test: `src/persistence/runStorageV2.test.ts`

**Interfaces:**
- Consumes: `POSITION_LADDER` (T1, via barrel — add to the `import ... from '../domain/combat'` line); `GroundState`.

The schema-version bump (4→5) means any persisted v4 blob is discarded on load (the loader already returns `defaults()` on version mismatch) — no migration needed. The engine now emits `phase:'ground'` with a non-null `ground`, and `window.method` is never `'ground'`.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to runStorageV2.test.ts
it('M16: round-trips a real ground-phase fight state', () => {
  // Build a state in the ground phase (helper mirrors resolveExchange takedown landing).
  const run = /* a RunState whose fight.phase === 'ground', fight.ground = { position: 'half-guard' } */;
  saveState({ run, bestReign: null });
  const loaded = loadState();
  expect(loaded.run?.fight?.phase).toBe('ground');
  expect(loaded.run?.fight?.ground).toEqual({ position: 'half-guard' });
});

it('M16: rejects a ground phase with a null ground field (clears to defaults)', () => {
  const bad = /* phase:'ground', ground:null, window:null, outcome:null */;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: bad, bestReign: null }));
  expect(loadState()).toEqual({ run: null, bestReign: null });
});

it('M16: rejects a ground state carrying a stale window (invariant: window null on ground)', () => {
  const bad = /* phase:'ground', ground:{position:'mount'}, window:{side:'player',method:'KO',stepsLeft:3} */;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: bad, bestReign: null }));
  expect(loadState()).toEqual({ run: null, bestReign: null });
});

it('M16: rejects window.method === "ground" (method dropped)', () => {
  const bad = /* phase:'finish-window', window:{side:'player',method:'ground',stepsLeft:3} */;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: bad, bestReign: null }));
  expect(loadState()).toEqual({ run: null, bestReign: null });
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**

```typescript
export const SCHEMA_VERSION = 5;                                    // was 4
// import POSITION_LADDER from the combat barrel:
import { STAT_IDS, INITIAL_STEPS, GAME_PLANS, EXCHANGES_PER_ROUND, POSITION_LADDER } from '../domain/combat';

const FIGHT_PHASES = ['in-round', 'corner', 'finish-window', 'ground', 'finished']; // 'ground-window'→'ground'
const WINDOW_METHODS = ['KO', 'submission'];                         // 'ground' dropped
const GROUND_POSITIONS = POSITION_LADDER as readonly string[];
```

In `isValidFightState`, add ground-field validation (after the `lastReport` check, before the invariant block):
```typescript
const ground = x['ground'];
if (ground !== null) {
  if (!isObject(ground)) return false;
  if (!GROUND_POSITIONS.includes(ground['position'] as string)) return false;
}
```

Replace the L110 `ground-window` invariant line with a `ground` invariant, and require `ground` null in every non-ground phase:
```typescript
// ground → window null AND outcome null AND ground non-null (valid position)
if (phase === 'ground' && (win !== null || out !== null || ground === null)) return false;
if (phase !== 'ground' && ground !== null) return false;
```
Keep the other four phase lines; just swap the `ground-window` line out.

- [ ] **Step 4: Run** — PASS; `tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(persistence): schema v5 — ground phase + ground-state invariant"`

---

### Task 8: Balance GATE — re-derive 6 bands + ground-dominance guard (B7)

**The hard gate.** Rewrite `playFight`'s ground routing with tuned good/careless policies, add a ground-spam policy for **B7**, delete every T6 interim shim, re-measure across 300 seeds, and hold all six M15 bands at PLAN strength plus the new B7. **Never weaken a band constant** — tune only `TAKEDOWN_PROFILES` and `groundEngine` consts. If a plan target is genuinely unreachable, apply the *Achievable-floor rule* (below) — but the six M15 bands' documented measured values were all comfortably clear in M15, so expect them to hold.

**Files:**
- Modify: `src/domain/combat/balance.test.ts`
- Modify (tuning only, if needed): `src/domain/combat/takedown.ts` (`TAKEDOWN_PROFILES`), `src/domain/combat/groundEngine.ts` (ground consts).

**Interfaces:**
- Consumes: `resolveGround`, `GroundAction`, `POSITION_SUBMISSION`, `nextPosition` (T1/T6).

- [ ] **Step 1: Replace the interim ground routing** in `playFight` with tuned policies. The good policy uses the ground intelligently; the careless policy still head-hunts (rarely shoots); add a dedicated ground-spam policy used ONLY by B7.

```typescript
// GOOD ground policy: climb toward a submission, tap when the position offers one; else G&P.
function goodGround(s: FightState): GroundAction {
  const pos = s.ground!.position;
  if (POSITION_SUBMISSION[pos] !== null) return 'submission';
  if (nextPosition(pos) !== null) return 'advance';
  return 'ground-and-pound';
}
// GROUND-SPAM policy (B7 only): always shoot, always climb+submit — the would-be exploit.
function wrestleSpamMove(s: FightState): ExchangeMove {
  return { kind: 'takedown', takedownType: 'double-leg' };
}
```
Route `while (s.phase === 'ground') s = resolveGround(s, goodGround(s));` inside the good simulation; the careless sim rarely reaches ground (keeps head-hunting) but if it does, use `goodGround` too (careless is defined by its STANDING choices).

- [ ] **Step 2: Add the B7 ground-dominance band.** Simulate a `wrestleSpam` policy (always `wrestleSpamMove` standing, `goodGround` on the mat) for fights 1..10, and assert:
```typescript
// B7a: ground spam vs champions is NOT an exploit (same late ceiling as head-hunt spam).
const GROUND_SPAM_CEILING_LATE = CARELESS_CEILING_LATE; // 0.42 — do NOT introduce a looser constant
expect(wrestleSpam.winRate[9]).toBeLessThanOrEqual(GROUND_SPAM_CEILING_LATE);
expect(wrestleSpam.winRate[10]).toBeLessThanOrEqual(GROUND_SPAM_CEILING_LATE);
// B7b: ground spam does not strictly dominate balanced play (aggregate).
expect(aggWinRate(wrestleSpam)).toBeLessThanOrEqual(aggWinRate(good) + 0.05);
```

- [ ] **Step 3: Delete T6 interim shims** — remove the `while (s.phase === 'ground') resolveGround(s, canSub?'submission':'advance')` interim block; the tuned policies above replace it.

- [ ] **Step 4: Measure → tune (new knobs only) → re-measure.** Run `npx vitest run src/domain/combat/balance.test.ts`. Read the printed 10-fight good/careless win+finish table. If any band fails:
  - B1 low → nudge `GNP_POSITION_SCALE` up or `TAKEDOWN_PROFILES` atkMult up (more finishes) — but watch B5/B7.
  - B5/B7 breached (ground too strong late) → lower elite-tier ground effectiveness: reduce `advanceProbability`/`groundSubProbability` scaling (`ADVANCE_SCALE`, `SUB_POSITION_SCALE`), or raise ground stamina costs. **Never** raise a band ceiling.
  - Re-run until all of B1–B7 pass. Print the final measured table in the commit body.

- [ ] **Step 5: Achievable-floor rule (only if a plan target is provably unreachable).** If, after honest tuning, a band's plan target cannot be met without breaking another band, set that band to the *measured achievable* value **and document it in the commit body with the measured table** — but do NOT lower B2 careless≤0.72, B5≤0.42, or B7 (the anti-exploit ceilings are inviolable). Prefer failing the task and reporting BLOCKED over weakening an anti-exploit ceiling.

- [ ] **Step 6: Determinism** — run the balance suite twice; the measured table must be identical.
- [ ] **Step 7: Commit** — `test(balance): re-derive 6 bands + ground-dominance guard (B7) for the ground tree` (measured table in the body).

---

### Task 9: UI — takedown-type sub-row + position-aware ground panel

**Files:**
- Modify: `src/components/StrikePanel.tsx` — replace the single Takedown button with a 4-type sub-row.
- Modify: `src/components/StrikePanel.test.tsx`.
- Rewrite: `src/components/GroundPanel.tsx` — position-aware.
- Rewrite: `src/components/GroundPanel.test.tsx`.

**Interfaces:**
- Consumes: `TakedownType`, `TAKEDOWN_TYPES`, `TAKEDOWN_LABELS`, `TAKEDOWN_BLURBS` (T2); `GroundState`, `GroundAction`, `GROUND_POSITION_LABELS`, `GROUND_ACTION_LABELS`, `POSITION_SUBMISSION`, `SUBMISSION_LABELS`, `nextPosition` (T1).
- Produces: `GroundPanel` props `{ ground: GroundState; onGroundAction: (a: GroundAction) => void; disabled?: boolean }`.

#### 9a: StrikePanel takedown sub-row

- [ ] **Test (RED):**
```typescript
// StrikePanel.test.tsx
it('renders a takedown type for each of the four shots and emits the chosen type', () => {
  const onMove = vi.fn();
  render(<StrikePanel onMove={onMove} exchange={1} exchangesPerRound={3} />);
  fireEvent.click(screen.getByTestId('takedown-single-leg'));
  expect(onMove).toHaveBeenCalledWith({ kind: 'takedown', takedownType: 'single-leg' });
  fireEvent.click(screen.getByTestId('takedown-body-lock'));
  expect(onMove).toHaveBeenCalledWith({ kind: 'takedown', takedownType: 'body-lock' });
});
```
(Delete/replace the old `toHaveBeenCalledWith({ kind: 'takedown' })` assertion.)

- [ ] **Implement:** below the 6-strike grid, render a labeled "Take it down" row mapping `TAKEDOWN_TYPES` → a button each:
```tsx
<div className="grid grid-cols-2 gap-2" data-testid="takedown-row">
  {TAKEDOWN_TYPES.map((t) => (
    <button key={t} type="button" data-testid={`takedown-${t}`}
      className="/* match existing button styling */"
      onClick={() => onMove({ kind: 'takedown', takedownType: t })}>
      <span className="font-semibold">{TAKEDOWN_LABELS[t]}</span>
      <span className="block text-xs opacity-70">{TAKEDOWN_BLURBS[t]}</span>
    </button>
  ))}
</div>
```
Keep the strike grid and the "Exchange X of Y" line. Shooting is still ONE click (the type IS the pick) — no extra beats.

#### 9b: GroundPanel rewrite

- [ ] **Test (RED):**
```typescript
// GroundPanel.test.tsx
const at = (position: GroundPosition) => ({ position });

it('shows current position and always offers ground & pound', () => {
  const onGroundAction = vi.fn();
  render(<GroundPanel ground={at('side-control')} onGroundAction={onGroundAction} />);
  expect(screen.getByText(/Side Control/i)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('ground-gnp'));
  expect(onGroundAction).toHaveBeenCalledWith('ground-and-pound');
});

it('hides advance at the back (no further position) and labels the submission by position', () => {
  const onGroundAction = vi.fn();
  render(<GroundPanel ground={at('back')} onGroundAction={onGroundAction} />);
  expect(screen.queryByTestId('ground-advance')).toBeNull();
  expect(screen.getByTestId('ground-sub')).toHaveTextContent(/Rear-Naked Choke/i);
  fireEvent.click(screen.getByTestId('ground-sub'));
  expect(onGroundAction).toHaveBeenCalledWith('submission');
});

it('hides submission in neutral guard (no submission available)', () => {
  render(<GroundPanel ground={at('guard')} onGroundAction={vi.fn()} />);
  expect(screen.queryByTestId('ground-sub')).toBeNull();
  expect(screen.getByTestId('ground-advance')).toBeInTheDocument();
});
```

- [ ] **Implement:**
```tsx
import type { GroundState, GroundAction } from '../domain/combat';
import { GROUND_POSITION_LABELS, POSITION_SUBMISSION, SUBMISSION_LABELS, nextPosition } from '../domain/combat';

export function GroundPanel({ ground, onGroundAction, disabled }: {
  ground: GroundState; onGroundAction: (a: GroundAction) => void; disabled?: boolean;
}) {
  const sub = POSITION_SUBMISSION[ground.position];
  const canAdvance = nextPosition(ground.position) !== null;
  return (
    <div data-testid="ground-panel" className="/* card styling */">
      <p className="text-sm uppercase tracking-wide opacity-70">Top Control · {GROUND_POSITION_LABELS[ground.position]}</p>
      <div className="grid gap-2">
        <button type="button" data-testid="ground-gnp" disabled={disabled}
          onClick={() => onGroundAction('ground-and-pound')}>Ground &amp; Pound</button>
        {canAdvance && (
          <button type="button" data-testid="ground-advance" disabled={disabled}
            onClick={() => onGroundAction('advance')}>Advance Position</button>
        )}
        {sub !== null && (
          <button type="button" data-testid="ground-sub" disabled={disabled}
            onClick={() => onGroundAction('submission')}>{SUBMISSION_LABELS[sub]}</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Run** both component suites → PASS; `tsc --noEmit` clean.
- [ ] **Commit** — `feat(fight-ui): takedown-type sub-row + position-aware ground panel`

---

### Task 10: Wire `FightView` + `App` + `fightDisplay`; FULL gate; dev-look

**Files:**
- Modify: `src/screens/FightView.tsx` — `onGroundAction` prop; render `GroundPanel` on `phase === 'ground'`.
- Modify: `src/screens/FightView.test.tsx`.
- Modify: `src/App.tsx` — `handleGroundAction` (uses `resolveGround`); pass `onGroundAction`.
- Modify: `src/App.test.tsx`.
- Modify: `src/fightDisplay.ts` — `roundLabel` `'ground'` case.
- Modify: `src/fightDisplay.test.ts`.

**Interfaces:**
- Consumes: `resolveGround`, `GroundAction` (T6); `GroundPanel` (T9); `GROUND_POSITION_LABELS` (T1).

#### 10a: FightView

- [ ] **Test (RED):** rendering a `phase:'ground'` state shows the `ground-panel`; clicking `ground-gnp` calls `onGroundAction`.
```typescript
it('renders the ground panel in the ground phase and forwards ground actions', () => {
  const onGroundAction = vi.fn();
  const s = /* a FightState with phase:'ground', ground:{position:'half-guard'} */;
  render(<FightView fightState={s} onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={onGroundAction} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
  expect(screen.getByTestId('ground-panel')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('ground-gnp'));
  expect(onGroundAction).toHaveBeenCalledWith('ground-and-pound');
});
```
- [ ] **Implement:** change the prop `onGroundStep: (p: GroundPlan) => void` → `onGroundAction: (a: GroundAction) => void`. Replace the `phase === 'ground-window'` block (L92-94):
```tsx
{fightState.phase === 'ground' && fightState.ground && (
  <GroundPanel ground={fightState.ground} onGroundAction={onGroundAction} />
)}
```
Keep `data-round`/`data-exchange`/`data-phase`/`data-player-head` attributes (resume test relies on them).

#### 10b: App

- [ ] **Test (RED):** a ground-phase run dispatches `resolveGround` (drive App to `phase:'ground'`, click `ground-advance`, assert the run advanced — e.g. `data-exchange` incremented or position changed).
- [ ] **Implement:** replace `handleGroundStep` (L40-44):
```tsx
import { resolveGround, type GroundAction } from './domain/combat';
// ...
const handleGroundAction = (action: GroundAction) =>
  setRun((r) => {
    if (!r.fight || r.fight.phase !== 'ground') return r;
    return { ...r, fight: resolveGround(r.fight, action) };
  });
```
Remove the `groundStep`/`GroundPlan` import. Pass `onGroundAction={handleGroundAction}` to `FightView` (was `onGroundStep={handleGroundStep}`).

#### 10c: fightDisplay `roundLabel`

- [ ] **Test (RED):**
```typescript
it('labels the ground phase with the current position', () => {
  const s = /* phase:'ground', ground:{position:'mount'}, round:2 */;
  expect(roundLabel(s)).toMatch(/Mount/i);
});
```
- [ ] **Implement:** replace the `'ground-window'` case (L37):
```typescript
if (state.phase === 'ground') {
  const pos = state.ground ? GROUND_POSITION_LABELS[state.ground.position] : 'Ground';
  return `${pos} · Round ${state.round}`;
}
```
Import `GROUND_POSITION_LABELS` from `./domain/combat`.

#### 10d: FULL gate
- [ ] `npx vitest run` twice → identical counts, all green.
- [ ] `npx tsc --noEmit` → clean.
- [ ] `npm run build` → clean.
- [ ] `grep -rn 'Math.random(' src` → 0 hits.
- [ ] `git diff --stat origin/main -- package.json package-lock.json` → empty.
- [ ] Balance suite green (B1–B7).

#### 10e: Dev-look — pacing & clicks (make-or-break)
- [ ] `npm run dev`; play a fight that goes to the ground. Confirm:
  - Shooting a takedown is ONE click (pick the type); landing shows the position ("Half Guard", etc.).
  - Ground beats share the round's 3-beat budget — a fight does NOT balloon into an endless click marathon. Count clicks for a full ground round: a shot on beat 1 yields ≤2 ground decisions, then Corner. If a typical ground round exceeds ~4 decisions or *feels* like it drags, **collapse the tree**: reduce ground beats (e.g. cap ground decisions per round at 2) or auto-resolve low-agency beats. Document the collapse in the commit + PR body.
  - Advancing changes the position label; a submission from mount/back can tap (fight ends, recap narrates); G&P can rock → the existing finish sequence takes over.
  - The opponent occasionally escapes back to standing (fluid, not stuck on the mat).
- [ ] **Commit** — `feat(fight-ui): wire full ground tree into FightView + App`

---

## Self-Review checklist (run before opening the PR)

1. **Spec coverage** (epic design lines 43-47): takedown TYPE (T2) ✓ · position ladder guard→back (T1) ✓ · position-gated submissions (T1 `POSITION_SUBMISSION`, T9 gating) ✓ · each ground beat = strike(G&P)/advance/submission (T6 `resolveGround`) ✓ · opponent resists via escape (T6 `escapeProbability`) ✓ · reuse finish-window machinery (T6 G&P rock → KO window; submission → finished) ✓ · balance: ground must not dominate (T8 B7) ✓ · determinism `#g` key (T6) ✓.
2. **Placeholder scan:** no `TBD`/`add validation`/`similar to`. The three test helpers that say "build a state whose fight.phase === 'ground'" MUST be filled with a concrete constructor during implementation (drive `resolveExchange` with a landing seed, or build the FightState literal) — they are the only deferred concretions and are flagged inline.
3. **Type consistency:** `GroundAction` (not `GroundPlan`) everywhere in M16 UI/engine; `onGroundAction` (not `onGroundStep`); `resolveGround` (not `groundStep`); `FightState.ground` typed `GroundState | null`; `TAKEDOWN_PROFILES[t].cost/atkMult/landsAt`; `POSITION_SUBMISSION[pos]` may be `null`.
4. **Never-weaken:** T8 tunes only `TAKEDOWN_PROFILES` + `groundEngine` consts; the 7 band constants (incl. B7 ceiling = `CARELESS_CEILING_LATE`) are inviolable.

## Execution Handoff

Subagent-Driven (recommended): fresh implementer + reviewer per task; two COUPLED tasks (T3 behavior-preserving retype; T6 phase model) land green only at the task's END. T7 ∥ T8 ∥ T9 can run in parallel after T6. T8 is the hard gate. T10 wires + dev-look last.
