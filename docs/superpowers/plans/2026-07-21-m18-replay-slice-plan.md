# M18 — Cinematic Fight Replay Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the cinematic-replay pipeline end-to-end on ONE hero moment — the engine emits a typed `ResolvedBeat[]` as a pure byproduct of the existing fight math, a pure projection turns each beat into a timed visual `BeatEvent[]`, and an SVG fighter "puppet" plays it back with real juice (impact flash, hitstop, screen-shake, knockdown). The marquee proof is **Conor McGregor's counter left straight ("the-left-hand") rendered as a visually + rhythmically distinct move** — not a reskinned power punch — plus a dev-only Replay Lab and a blind feel-gate.

**Architecture:** Three isolated layers with a one-way dependency (`replay/` → `domain/`, never the reverse). (1) **Domain emission**: `resolveExchange` appends a `ResolvedBeat` — assembled from before/after state locals, adding no new RNG draw — to a non-persisted `beats: ResolvedBeat[]` on `FightState`. (2) **Presentation projection** (`src/replay/timeline.ts`): pure `buildBeatTimeline(beat, presentationSeed) → BeatEvent[]`; cosmetic variety comes from `createRng(presentationSeed + '#' + beat.id)` and is never fed back into the domain. (3) **Render** (`src/components/FighterRig.tsx` + `src/replay/FightReplay.tsx`): a pose-able SVG rig driven over wall-clock time, with a `prefers-reduced-motion` snap-to-result fallback. A hidden Replay Lab route drives the feel-gate.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind + Vitest/RTL. SVG + CSS transforms + `requestAnimationFrame`/Web Animations API for motion. Reuse `createRng` from `src/domain/rng.ts`. **No new dependencies.**

## Global Constraints

- **No `Math.random`, `Date.now`, or `useId` in production `src/`** (non-test). All randomness via seeded `createRng(seed)` from `src/domain/rng.ts`. Verify: `grep -rn "Math.random\|Date.now" src --include=*.ts --include=*.tsx | grep -v ".test."` → 0.
- **No new dependencies.** `package.json` + `package-lock.json` byte-identical to `origin/main`. Verify: `git diff --stat origin/main -- package.json package-lock.json` → empty.
- **One-way import rule:** files in `src/replay/` and the rig may import from `src/domain/`; **nothing in `src/domain/` may import from `src/replay/` or `src/components/`.** Verify: `grep -rn "from '.*replay" src/domain` → 0.
- **Determinism:** `npx vitest run` twice → byte-identical counts. Same `(fightSeed, moves)` → identical `ResolvedBeat[]`; same `(beat, presentationSeed)` → identical `BeatEvent[]`.
- **Domain purity preserved:** `resolveExchange` must remain a pure function; the beat is derived from locals already computed, adding **zero** new `rng()` calls (verified by an RNG-draw-count test in T2).
- **No regressions:** every existing test stays green (`FighterAvatar` 5 tests, `FightView` tests, balance bands, persistence). `tsc --noEmit` clean; `npm run build` clean.
- **Commit trailers on EVERY commit, exactly:**
  ```
  Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
  Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d
  ```
- **Reduced motion:** any component with motion MUST honor `prefers-reduced-motion: reduce` (none exists in the codebase today — implement it).
- **Scope fence:** ONE strike family (punches: jab/cross/hook) + ONE signature (McGregor `the-left-hand`) + knockdown are the only fully-animated paths. All other moves fall back to a generic "generic-strike" beat visual. NO ground-game visuals, NO audio, NO PixiJS (deferred to M19+).

---

## File Structure

**Create:**
- `src/domain/combat/beat.ts` — `ResolvedBeat` + sub-types + `buildResolvedBeat(...)` pure assembler.
- `src/domain/combat/beat.test.ts`
- `src/replay/timeline.ts` — `BeatEvent`, `buildBeatTimeline(beat, presentationSeed)`.
- `src/replay/timeline.test.ts`
- `src/components/fighterPalette.ts` — extracted deterministic `fighterPalette(seed, archetype)` (skin/glove/accent/hair/bg).
- `src/components/fighterPalette.test.ts`
- `src/components/FighterRig.tsx` — pose-able SVG puppet.
- `src/components/FighterRig.test.tsx`
- `src/replay/poses.ts` — `Pose` type + `POSES` keyframe table (idle/guard/jab/cross/hook/hit-head/hit-body/reel/down/slip/sig-load/sig-fire).
- `src/replay/FightReplay.tsx` — timeline-driven renderer (juice + reduced-motion).
- `src/replay/FightReplay.test.tsx`
- `src/replay/simulateFight.ts` — dev/test helper: scripted fixed-seed fight → `ResolvedBeat[]` (used by Replay Lab + feel-gate; pure, uses domain only).
- `src/screens/ReplayLab.tsx` — hidden dev route to scrub a fixed-seed clip.
- `src/replay/feel-gate.md` — the blind-classification protocol + result table (committed evidence).

**Modify:**
- `src/domain/combat/fightState.ts` — add `beats: ResolvedBeat[]` to `FightState`; init `[]` in `startFight`.
- `src/domain/combat/exchange.ts` — capture leg + stamina deltas, outcome, takedownType; append `buildResolvedBeat(...)` to `beats` at the end of each resolution branch.
- `src/domain/combat/index.ts` — barrel already `export *`; ensure `beat.ts` is exported.
- `src/persistence/runStorageV2.ts` — strip `beats` on save, default `[]` on load (no schema bump; `beats` is presentation-derived, non-authoritative).
- `src/persistence/runStorageV2.test.ts` — round-trip test: `beats` excluded from persisted JSON, rehydrates to `[]`, fight still valid.
- `src/components/FighterAvatar.tsx` — import palette from the new `fighterPalette.ts` (behavior byte-identical; keep all 5 tests green).
- `src/screens/FightView.tsx` — mount `<FightReplay>` between the health-card row and `<SignatureMeter>`.
- `src/App.tsx` — add a hidden `?lab=1` branch that renders `<ReplayLab>` (dev harness; not in main nav).

---

## Task 0: Commit M18 docs

**Files:**
- Create: `docs/superpowers/plans/2026-07-21-m18-replay-slice-plan.md` (this file, verbatim)
- Verify present: `docs/superpowers/specs/2026-07-20-cinematic-fight-epic-design.md` (shipped in M17.1)

- [ ] **Step 1:** Copy this plan to `docs/superpowers/plans/2026-07-21-m18-replay-slice-plan.md`.
- [ ] **Step 2:** Confirm the epic design doc already exists at `docs/superpowers/specs/2026-07-20-cinematic-fight-epic-design.md` (from M17.1). If missing, copy it from the handoff.
- [ ] **Step 3: Commit**
```bash
git add docs/superpowers/plans/2026-07-21-m18-replay-slice-plan.md
git commit -m "docs: M18 cinematic replay vertical-slice plan

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

## Task 1: `ResolvedBeat` contract + pure assembler

**Files:**
- Create: `src/domain/combat/beat.ts`, `src/domain/combat/beat.test.ts`

**Interfaces:**
- Produces (later tasks + `src/replay/` consume these exact types):
```ts
export type BeatActor = 'player' | 'opponent';
export type BeatMoveClass =
  | 'advance' | 'strike' | 'evade' | 'counter' | 'impact' | 'knockdown' | 'signature' | 'takedown' | 'ground';
export type BeatOutcome = 'landed' | 'evaded' | 'blocked' | 'countered';
export type BeatTarget = 'head' | 'body' | 'legs' | null;

export interface BeatDeltas {
  playerHead: number; playerBody: number; playerLeg: number; playerStamina: number;
  opponentHead: number; opponentBody: number; opponentLeg: number; opponentStamina: number;
}
export interface BeatStatus {
  playerBecameRocked: boolean; opponentBecameRocked: boolean;
  playerGassed: boolean; opponentGassed: boolean;
}
export interface ResolvedBeat {
  id: string;              // `${round}-${exchange}` — stable, deterministic key
  round: number;
  exchange: number;
  actorId: BeatActor;      // decisive winner of the beat (draw → 'player' by convention, outcome 'evaded')
  targetId: BeatActor;     // the other fighter
  moveClass: BeatMoveClass;
  moveId: string | null;   // StrikeId | signatureId | TakedownType | null
  outcome: BeatOutcome;
  target: BeatTarget;
  deltas: BeatDeltas;
  status: BeatStatus;
  signatureId: string | null; // set when the player's decisive move was a signature detonation
  isFinish: boolean;
  finishMethod: 'KO' | 'submission' | null;
}

export interface BuildBeatArgs {
  round: number; exchange: number;
  winner: 'player' | 'opponent' | 'draw';
  dominance: number;
  moveClass: BeatMoveClass;
  moveId: string | null;
  target: BeatTarget;
  deltas: BeatDeltas;
  status: BeatStatus;
  signatureId: string | null;
  isFinish: boolean;
  finishMethod: 'KO' | 'submission' | null;
}
export function buildResolvedBeat(a: BuildBeatArgs): ResolvedBeat;
```
- `buildResolvedBeat` maps `winner`→`actorId`/`targetId` (draw → actor `'player'`), and derives `outcome`:
  - `isFinish` → `'landed'`.
  - `signatureId != null` **and** player won → `'countered'` (the signature slice is a counter).
  - `winner === 'draw'` or `|dominance| < DRAW_EPS (=6)` → `'evaded'`.
  - actor dealt damage to `target` (relevant delta > 0) → `'landed'`; else `'blocked'`.

- [ ] **Step 1: Write the failing test** — `src/domain/combat/beat.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { buildResolvedBeat, type BuildBeatArgs } from './beat';

const base: BuildBeatArgs = {
  round: 1, exchange: 3, winner: 'player', dominance: 40,
  moveClass: 'strike', moveId: 'cross', target: 'head',
  deltas: { playerHead:0,playerBody:0,playerLeg:0,playerStamina:-4, opponentHead:22,opponentBody:0,opponentLeg:0,opponentStamina:-2 },
  status: { playerBecameRocked:false, opponentBecameRocked:true, playerGassed:false, opponentGassed:false },
  signatureId: null, isFinish: false, finishMethod: null,
};

it('maps winner to actor/target and stable id', () => {
  const b = buildResolvedBeat(base);
  expect(b.id).toBe('1-3');
  expect(b.actorId).toBe('player');
  expect(b.targetId).toBe('opponent');
  expect(b.outcome).toBe('landed');
});
it('classifies a small-margin exchange as evaded', () => {
  expect(buildResolvedBeat({ ...base, dominance: 3 }).outcome).toBe('evaded');
});
it('classifies a player signature detonation as countered', () => {
  const b = buildResolvedBeat({ ...base, moveClass:'signature', signatureId:'the-left-hand', dominance: 90 });
  expect(b.outcome).toBe('countered');
  expect(b.signatureId).toBe('the-left-hand');
});
it('a finish is always landed and carries the method', () => {
  const b = buildResolvedBeat({ ...base, isFinish:true, finishMethod:'KO', dominance: 120 });
  expect(b.outcome).toBe('landed');
  expect(b.isFinish).toBe(true);
  expect(b.finishMethod).toBe('KO');
});
it('opponent winner flips actor/target', () => {
  const b = buildResolvedBeat({ ...base, winner:'opponent', deltas: { ...base.deltas, opponentHead:0, playerHead:18 } });
  expect(b.actorId).toBe('opponent');
  expect(b.targetId).toBe('player');
  expect(b.outcome).toBe('landed');
});
```
- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './beat'`). `npx vitest run src/domain/combat/beat.test.ts`
- [ ] **Step 3: Implement `beat.ts`** — the types above + `buildResolvedBeat`:
```ts
const DRAW_EPS = 6;
export function buildResolvedBeat(a: BuildBeatArgs): ResolvedBeat {
  const actorId: BeatActor = a.winner === 'opponent' ? 'opponent' : 'player';
  const targetId: BeatActor = actorId === 'player' ? 'opponent' : 'player';
  const dmgToTarget = targetId === 'opponent'
    ? a.deltas.opponentHead + a.deltas.opponentBody + a.deltas.opponentLeg
    : a.deltas.playerHead + a.deltas.playerBody + a.deltas.playerLeg;
  let outcome: BeatOutcome;
  if (a.isFinish) outcome = 'landed';
  else if (a.signatureId != null && a.winner === 'player') outcome = 'countered';
  else if (a.winner === 'draw' || Math.abs(a.dominance) < DRAW_EPS) outcome = 'evaded';
  else outcome = dmgToTarget > 0 ? 'landed' : 'blocked';
  return { id: `${a.round}-${a.exchange}`, round: a.round, exchange: a.exchange,
    actorId, targetId, moveClass: a.moveClass, moveId: a.moveId, outcome, target: a.target,
    deltas: a.deltas, status: a.status, signatureId: a.signatureId,
    isFinish: a.isFinish, finishMethod: a.finishMethod };
}
```
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** (`git add src/domain/combat/beat.ts src/domain/combat/beat.test.ts` → `feat(M18): ResolvedBeat contract + pure assembler`).

---

## Task 2: Emit beats from `resolveExchange` (RNG-safe)

**Files:**
- Modify: `src/domain/combat/fightState.ts` (add `beats` field + init), `src/domain/combat/exchange.ts` (capture leg/stamina deltas + outcome inputs; append beat), `src/domain/combat/index.ts` (ensure `beat.ts` exported)
- Test: `src/domain/combat/exchange.test.ts` (append cases)

**Interfaces:**
- Consumes: `buildResolvedBeat`, `ResolvedBeat` (Task 1); existing `resolveExchange(state, move)`, `RoundLogEntry`, `ROCKED_HEAD_DMG`, `isGassed`.
- Produces: `FightState.beats: ResolvedBeat[]` (append-only, one entry per resolved standing/finish beat). `startFight` initializes `beats: []`.

**Grounding (recon):** the winner/dominance/head+body deltas/rocked/gassed transitions/signature-charge/isFinish/finishMethod are already computed in `exchange.ts`. Leg + stamina deltas are computed but discarded; recompute them locally as `after.X - before.X`. **Do not add any `createRng`/`rng()` call.** The beat is assembled AFTER `rng()` draws for the beat are complete, from finalized locals.

- [ ] **Step 1: Write the failing tests** (append to `exchange.test.ts`):
```ts
it('appends exactly one ResolvedBeat per resolved standing beat', () => {
  const s0 = /* startFight fixture, deterministic seed */;
  const s1 = resolveExchange(s0, { kind: 'strike', strike: 'cross' });
  expect(s1.beats.length).toBe(s0.beats.length + 1);
  const b = s1.beats[s1.beats.length - 1];
  expect(b.round).toBe(s1.round);
  expect(b.moveClass === 'strike' || b.moveClass === 'evade').toBe(true);
});
it('captures leg + stamina deltas that the old report dropped', () => {
  const s0 = /* fixture with legDamage/stamina primed */;
  const s1 = resolveExchange(s0, { kind: 'strike', strike: 'legKick' });
  const b = s1.beats.at(-1)!;
  // stamina always spent by the actor's strike
  expect(b.deltas.playerStamina).toBeLessThanOrEqual(0);
  expect(typeof b.deltas.opponentLeg).toBe('number');
});
it('emitting a beat does not perturb RNG ordering (parity vs pre-beat resolution)', () => {
  // Resolve a fixed seed+move sequence; assert the damage/winner outcomes match
  // the known-good snapshot from before beats existed (regression guard).
  const s = playScript(fixedSeed, ['cross','jab','cross']); // helper in test
  expect(s.opponent.headDamage).toBe(EXPECTED_HEAD_SNAPSHOT); // pin pre-beat value
});
it('a signature detonation beat carries signatureId + moveClass signature', () => {
  const s0 = /* charged signature-ready fixture, McGregor the-left-hand */;
  const s1 = resolveExchange(s0, { kind: 'signature' });
  const b = s1.beats.at(-1)!;
  expect(b.moveClass).toBe('signature');
  expect(b.signatureId).toBe('the-left-hand');
});
```
- [ ] **Step 2: Run — expect FAIL** (`beats` undefined / snapshot mismatch until wired). Record the RED failures.
- [ ] **Step 3: Implement.**
  - `fightState.ts`: add `beats: ResolvedBeat[]` to the `FightState` interface; in `startFight`, set `beats: []`. Thread `beats` through every `{ ...state, ... }` return that already exists in `exchange.ts` (append, don't reset).
  - `exchange.ts`: at each terminal return (standing win/lose/draw, signature, finish), compute:
    ```ts
    const deltas: BeatDeltas = {
      playerHead: p.headDamage - state.player.headDamage,
      playerBody: p.bodyDamage - state.player.bodyDamage,
      playerLeg: p.legDamage - state.player.legDamage,
      playerStamina: p.stamina - state.player.stamina,
      opponentHead: o.headDamage - state.opponent.headDamage,
      opponentBody: o.bodyDamage - state.opponent.bodyDamage,
      opponentLeg: o.legDamage - state.opponent.legDamage,
      opponentStamina: o.stamina - state.opponent.stamina,
    };
    const status: BeatStatus = {
      playerBecameRocked: state.player.headDamage < ROCKED_HEAD_DMG(state.player.chin) && p.headDamage >= ROCKED_HEAD_DMG(state.player.chin),
      opponentBecameRocked: state.opponent.headDamage < ROCKED_HEAD_DMG(state.opponent.chin) && o.headDamage >= ROCKED_HEAD_DMG(state.opponent.chin),
      playerGassed: isGassed(p.stamina), opponentGassed: isGassed(o.stamina),
    };
    const beat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner, dominance,
      moveClass: /* 'signature' if playerMove.kind==='signature'; 'takedown' if takedown branch; else 'strike' */,
      moveId: /* winnerMove.strike | signatureId | takedownType | null */,
      target: /* strike/signature target zone | null */,
      deltas, status, signatureId: /* detonated signatureId | null */,
      isFinish: finishWindow !== null, finishMethod: /* detectWindow method | null */ });
    return { ...next, beats: [...state.beats, beat] };
    ```
  - Keep `moveClass` mapping minimal for the slice: signature→`'signature'`, takedown branch→`'takedown'`, otherwise `'strike'`. (The timeline layer refines strike→evade/counter cosmetics.)
- [ ] **Step 4: Run — expect PASS**, and confirm the RNG-parity snapshot test passes (proves no perturbation). Full `npx vitest run src/domain/combat` green.
- [ ] **Step 5: Commit** (`feat(M18): emit ResolvedBeat[] from resolveExchange (leg+stamina deltas, RNG-safe)`).

---

## Task 3: Keep `beats` out of persistence (no schema bump)

**Files:**
- Modify: `src/persistence/runStorageV2.ts`
- Test: `src/persistence/runStorageV2.test.ts`

**Rationale:** `beats` is presentation-derived and non-authoritative; persisting it would force a schema migration and bloat saves. Strip on save; default `[]` on load. Schema stays **v6**.

- [ ] **Step 1: Write the failing tests:**
```ts
it('does not serialize beats into the persisted blob', () => {
  const run = /* run with fight.beats = [oneBeat] */;
  save(run);
  const raw = localStorage.getItem(STORAGE_KEY)!;
  expect(raw.includes('"beats"')).toBe(false);
});
it('rehydrates a loaded fight with an empty beats array', () => {
  save(/* run with fight.beats populated */);
  const loaded = load();
  expect(loaded.run?.fight?.beats).toEqual([]);
});
it('a v6 blob without beats still loads as valid', () => {
  localStorage.setItem(STORAGE_KEY, /* legacy v6 fixture, no beats key */);
  expect(load().run).not.toBeNull();
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement:** in the serialize path, build the fight blob without `beats` (omit the key). In `isValidFightState` / hydrate path, set `beats: []` when absent (do not require it). Keep version at `6`.
- [ ] **Step 4: Run — expect PASS.** Full persistence suite green.
- [ ] **Step 5: Commit** (`feat(M18): exclude non-authoritative beats from persistence (schema stays v6)`).

---

## Task 4: Extract `fighterPalette` (DRY, behavior-identical)

**Files:**
- Create: `src/components/fighterPalette.ts`, `src/components/fighterPalette.test.ts`
- Modify: `src/components/FighterAvatar.tsx` (import palette; keep all 5 tests green)

**Interfaces:**
- Produces: `export interface FighterPalette { skin:string; glove:string; accent:string; hair:string; bg:string } ; export function fighterPalette(seed: string, archetype: string): FighterPalette`
- The function reproduces FighterAvatar's EXISTING deterministic color logic byte-for-byte (same `createRng(seed)` draws, same archetype→accent map, same skin/hair/bg pools, same draw ORDER).

- [ ] **Step 1: Write the failing test** — pin the extracted output to the avatar's current colors for a couple of known seeds (read them off the current implementation first), + determinism + archetype accent hexes (mirror FighterAvatar test #3).
- [ ] **Step 2: Run — expect FAIL** (module missing).
- [ ] **Step 3: Implement** `fighterPalette.ts` by lifting the exact color block from `FighterAvatar.tsx` (preserve rng draw order); then refactor `FighterAvatar.tsx` to `const { skin, glove, accent, hair, bg } = fighterPalette(seed, archetype)`.
- [ ] **Step 4: Run — expect PASS** for `fighterPalette.test.ts` **and** all 5 existing `FighterAvatar.test.tsx` tests (byte-identical SVG guaranteed by identical draws).
- [ ] **Step 5: Commit** (`refactor(M18): extract deterministic fighterPalette shared by avatar + rig`).

---

## Task 5: Pose table + `FighterRig` SVG puppet

**Files:**
- Create: `src/replay/poses.ts`, `src/components/FighterRig.tsx`, `src/components/FighterRig.test.tsx`

**Interfaces:**
- `poses.ts` produces:
```ts
export type PoseName =
  | 'idle' | 'guard' | 'jab' | 'cross' | 'hook' | 'slip'
  | 'hit-head' | 'hit-body' | 'reel' | 'down' | 'sig-load' | 'sig-fire';
export interface Pose { // normalized limb transforms in the rig's 160x220 viewBox
  torsoRotate: number; headX: number; headY: number;
  leadArm: { rotate: number; extend: number }; // extend 0..1
  rearArm: { rotate: number; extend: number };
  lean: number; // px horizontal torso shift (+ = toward opponent)
}
export const POSES: Record<PoseName, Pose>;
```
- `FighterRig` produces: `export interface FighterRigProps { seed:string; archetype:string; name:string; pose:PoseName; facing:'left'|'right'; flashHead?:boolean; flashBody?:boolean; downed?:boolean } ; export default function FighterRig(props): JSX.Element` — pure SVG, colors from `fighterPalette(seed, archetype)`. Renders `data-testid="fighter-rig"`, `data-pose={pose}`, `data-facing={facing}`, and `role="img"` with `aria-label={`${name} ${pose}`}`.

- [ ] **Step 1: Write failing tests** — rig renders with `data-pose`/`data-facing`; different `pose` → different transform on the lead-arm group (`getByTestId('rig-lead-arm').getAttribute('transform')` differs between `guard` and `cross`); determinism (same props → identical markup); reduced-motion is not this component's concern (static); `facing='left'` mirrors via a `scale(-1,1)` group transform.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `POSES` (hand-tuned constants) and `FighterRig` (torso rect, head ellipse reusing palette, two arm groups = upper+forearm+glove built from the pose's rotate/extend, guard/idle default). Facing flips via a wrapping `<g transform="scale(-1,1) translate(-160,0)">` when `facing==='left'`. `flashHead`/`flashBody` add a translucent white overlay rect over that zone; `downed` rotates the whole rig ~80° and drops it.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** (`feat(M18): pose table + FighterRig SVG puppet`).

---

## Task 6: `buildBeatTimeline` — pure presentation projection

**Files:**
- Create: `src/replay/timeline.ts`, `src/replay/timeline.test.ts`

**Interfaces:**
- Consumes: `ResolvedBeat` (domain), `createRng` (domain/rng).
- Produces:
```ts
export type BeatEventKind =
  | 'windup' | 'strike' | 'slip' | 'impact' | 'block' | 'reaction' | 'knockdown' | 'recover'
  | 'flash' | 'hitstop' | 'shake';
export interface BeatEvent {
  tMs: number;                 // start offset from beat start
  durMs: number;
  kind: BeatEventKind;
  actor: BeatActor;            // whose rig this drives ('impact'/'flash' target the struck fighter)
  pose?: PoseName;             // pose to apply to `actor` for this window
  intensity?: number;          // 0..1 (drives shake px, flash alpha)
  zone?: 'head' | 'body';
}
export interface BeatTimeline { totalMs: number; events: BeatEvent[] }
export function buildBeatTimeline(beat: ResolvedBeat, presentationSeed: string): BeatTimeline;
```
- **Pure + deterministic.** Cosmetic jitter via `const rng = createRng(presentationSeed + '#' + beat.id)`; only used for small timing/intensity variety (±) — **never** returned to domain. No `Math.random`.
- **Mapping rules (the heart of the slice):**
  - `moveClass==='signature'` (McGregor `the-left-hand`): `windup`(opponent commits, pose `cross`) → `slip`(actor pose `slip`, defensive) → `strike`(actor pose `sig-load`→`sig-fire`) → `impact`(target `hit-head`, intensity 1) → `flash`+`hitstop`(long, ~120ms)+`shake`(strong) → `knockdown` if `isFinish` (target `down`) → `recover`. Longer total, distinct rhythm.
  - `moveClass==='strike'`, `outcome==='landed'`: `windup`(actor `jab`/`cross`/`hook` by `moveId`) → `strike` → `impact`(target `hit-head|hit-body` by `target`) → `flash`+`shake`(intensity from head-delta) → `reaction`(target `reel` if `status.*BecameRocked` else brief) → `recover`.
  - `outcome==='evaded'`: `windup`(actor strike) → `slip`(target) → `recover`. No flash/shake.
  - `outcome==='blocked'`: `windup` → `strike` → `block`(target `guard`) → small `shake` → `recover`.
  - `isFinish` (non-signature): append `knockdown`(target `down`) + extended `hitstop`.
  - Non-punch `moveId` (not jab/cross/hook) → treat as generic `strike` with `cross` pose (scope fallback).

- [ ] **Step 1: Write failing tests:**
```ts
it('is deterministic for the same beat + seed', () => {
  const a = buildBeatTimeline(beatFixture, 'seed#1');
  const b = buildBeatTimeline(beatFixture, 'seed#1');
  expect(a).toEqual(b);
});
it('a landed head cross produces windup->strike->impact->flash with a head hit-reaction', () => {
  const t = buildBeatTimeline(landedCrossHead, 'p');
  const kinds = t.events.map(e => e.kind);
  expect(kinds).toEqual(expect.arrayContaining(['windup','strike','impact','flash']));
  const impact = t.events.find(e => e.kind==='impact')!;
  expect(impact.actor).toBe('opponent');    // the struck fighter
  expect(impact.zone).toBe('head');
});
it('the McGregor signature is rhythmically distinct: has a slip + long hitstop, longer than a normal cross', () => {
  const sig = buildBeatTimeline(sigCounterLeft, 'p');
  const cross = buildBeatTimeline(landedCrossHead, 'p');
  expect(sig.events.some(e => e.kind==='slip')).toBe(true);
  const sigStop = sig.events.find(e => e.kind==='hitstop')!;
  const crossStop = cross.events.find(e => e.kind==='hitstop');
  expect(sigStop.durMs).toBeGreaterThan(crossStop?.durMs ?? 0);
  expect(sig.totalMs).toBeGreaterThan(cross.totalMs);
});
it('an evaded beat has no flash or knockdown', () => {
  const t = buildBeatTimeline(evadedBeat, 'p');
  expect(t.events.some(e => e.kind==='flash')).toBe(false);
  expect(t.events.some(e => e.kind==='knockdown')).toBe(false);
});
it('a KO finish appends a knockdown', () => {
  expect(buildBeatTimeline(koFinishBeat,'p').events.some(e=>e.kind==='knockdown')).toBe(true);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** the mapping (a switch on `moveClass`/`outcome`, pushing events with cumulative `tMs`; `createRng` for ±10ms/±0.1 jitter). Compute `totalMs` from the last event end.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** (`feat(M18): buildBeatTimeline pure projection (McGregor counter-left distinct)`).

---

## Task 7: `FightReplay` renderer (juice + reduced motion)

**Files:**
- Create: `src/replay/FightReplay.tsx`, `src/replay/FightReplay.test.tsx`

**Interfaces:**
- Consumes: `BeatTimeline`/`buildBeatTimeline`, `FighterRig`, `ResolvedBeat`.
- Produces: `export interface FightReplayProps { beat: ResolvedBeat | null; playerId?:string; playerName:string; playerArchetype:string; opponentId?:string; opponentName:string; opponentArchetype:string; presentationSeed:string; autoPlay?:boolean }` ; default export component.
- Behavior: on a new `beat` (identity change), build the timeline and drive both rigs' poses over wall-clock time via `requestAnimationFrame`, applying container `translate` for `shake`, a white overlay for `flash`, freezing the clock for `hitstop`. Exposes `data-testid="fight-replay"`, `data-playing`, and (for tests) a `data-final-pose-player`/`-opponent` reflecting the end state.
- **Reduced motion:** if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, skip rAF entirely and render the **final** poses/flash-result immediately (no shake, no hitstop). A test forces this via a `matchMedia` mock.

- [ ] **Step 1: Write failing tests:**
```ts
it('renders two rigs and starts idle when beat is null', () => { /* both rigs data-pose="idle" */ });
it('with reduced-motion, snaps to the resolved end pose without animating (rocked opponent shows reel/down)', () => {
  mockReducedMotion(true);
  render(<FightReplay beat={sigKoBeat} .../>);
  expect(screen.getByTestId('fight-replay').getAttribute('data-final-pose-opponent')).toBe('down');
});
it('applies a flash overlay when the beat lands on the head', () => { /* fake timers, advance to impact, assert flash node present */ });
it('is deterministic: same beat+seed → same end DOM (snapshot)', () => { /* two renders equal */ });
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** with `useEffect` + `requestAnimationFrame` (guarded by a reduced-motion branch that computes final state synchronously). Use fake timers / rAF stubs in tests. Clean up rAF on unmount and on `beat` change.
- [ ] **Step 4: Run — expect PASS.** Verify no `Date.now` (use the rAF timestamp arg for the clock).
- [ ] **Step 5: Commit** (`feat(M18): FightReplay renderer with hitstop/flash/shake + reduced-motion`).

---

## Task 8: `simulateFight` helper + Replay Lab + wire into FightView

**Files:**
- Create: `src/replay/simulateFight.ts`, `src/replay/simulateFight.test.ts`, `src/screens/ReplayLab.tsx`
- Modify: `src/screens/FightView.tsx`, `src/App.tsx`

**Interfaces:**
- `simulateFight` produces: `export function simulateFight(seed: string, script: ExchangeMove[]): { beats: ResolvedBeat[]; final: FightState }` — pure; loops `resolveExchange` (advancing rounds/game-plans as needed), collecting `final.beats`. Used by the Lab + feel-gate to get a full clip including the McGregor counter-left.
- `ReplayLab` produces: a screen that runs a **fixed seed + fixed script** guaranteeing the signature fires, then lets the user step/scrub beat-by-beat through `<FightReplay>` (Prev/Next/Replay buttons showing `beat i / n`).

- [ ] **Step 1: Write failing tests** — `simulateFight` returns `beats.length === script length` (for non-finishing scripts) and is deterministic; a scripted McGregor signature clip contains a beat with `signatureId==='the-left-hand'`; `FightView` mounts `data-testid="fight-replay"` between the health cards and the signature meter (query order); `App` with `?lab=1` renders the Lab.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `simulateFight`; `ReplayLab` (fixed seed, scripted draft→charged→signature sequence, Prev/Next/Replay wired to a `beatIndex` state feeding `<FightReplay beat={beats[i]} .../>`); mount `<FightReplay beat={fightState.beats.at(-1) ?? null} presentationSeed={fightState.seed} .../>` in `FightView` at the recon mount point (after the `FighterHealthCard` row, before `<SignatureMeter>`); add the `?lab=1` branch in `App.tsx` (read `new URLSearchParams(window.location.search)` once).
- [ ] **Step 4: Run — expect PASS.** Full `npx vitest run` green.
- [ ] **Step 5: Commit** (`feat(M18): simulateFight helper + Replay Lab + FightView replay mount`).

---

## Task 9: Feel-gate protocol + evidence, full gate, PR

**Files:**
- Create: `src/replay/feel-gate.md`
- (No code; this task is the human-facing gate + final verification.)

- [ ] **Step 1:** Write `src/replay/feel-gate.md` — the blind-classification protocol:
  > Open `?lab=1`. For each of 5 fixed-seed clips (ids listed), WITHOUT reading labels, write down: (a) hit / miss / block / counter, (b) target head or body, (c) did a fighter get rocked or dropped, (d) which clip was the signature. Then reveal the answer key (the `ResolvedBeat` fields, printed by the Lab). **Ship criteria:** classification correct on ≥ 4/5 clips; the McGregor counter-left is unmistakably identified as "different" from a normal cross; subjective impact ≥ 4/5; and the tester answers "yes" to *"would I screenshot/record this as store-page proof?"* Record results in the table below.
  Include an empty results table (clip id | guessed outcome | actual | ✓/✗ | impact 1–5).
- [ ] **Step 2:** Run the **full gate** and paste results into the PR body:
  - `npx vitest run` ×2 (byte-identical) · `npx tsc --noEmit` · `npm run build`
  - `grep -rn "Math.random\|Date.now" src --include=*.ts --include=*.tsx | grep -v ".test."` → 0
  - `grep -rn "from '.*replay" src/domain` → 0 (one-way import)
  - `git diff --stat origin/main -- package.json package-lock.json` → empty
  - Balance bands (`npx vitest run src/domain/combat/balance.test.ts`) still green (beats don't touch balance).
- [ ] **Step 3: Commit** the feel-gate doc (`docs(M18): blind feel-gate protocol + results table`).
- [ ] **Step 4:** Push branch `m18-replay-slice`; open ONE PR into `main` titled `M18: cinematic fight replay vertical slice (McGregor counter-left)` with the gate evidence + a note that the **human feel-gate is pending live validation**. **Do NOT merge.** Report back with PR URL, HEAD SHA, CI status on the exact SHA, per-commit trailer audit, and the gate table.

---

## Self-Review (completed inline)

**Spec coverage vs epic design:** ResolvedBeat contract ✅ (T1) with the recon-flagged gaps (leg/stamina deltas, outcome enum, takedownType-capable moveClass) ✅ (T2). Pure `buildBeatTimeline` + cosmetic-RNG-never-fed-back ✅ (T6). One-way import rule enforced by a grep gate ✅ (Global Constraints, T9). SVG-first rig extending the avatar palette ✅ (T4/T5), PixiJS deferred ✅ (scope fence). One strike family + one signature (McGregor the-left-hand) ✅ (scope fence, T6). Juice: flash/hitstop/shake/knockdown ✅ (T6/T7). Reduced-motion ✅ (T7). Replay Lab + blind feel-gate ✅ (T8/T9). Persistence untouched-authoritatively ✅ (T3). Determinism ✅ (Global + tests in T1/T6/T7/T8).

**Placeholder scan:** the only intentionally-open items are the human feel-gate *results* (filled live) and a few `/* fixture */` comments in test steps where the executor builds a `startFight` fixture from existing helpers — acceptable (the shapes + assertions are fully specified). No "TBD/implement later" in production code steps.

**Type consistency:** `ResolvedBeat`/`BeatActor`/`PoseName`/`BeatEvent` names are used identically across T1→T2→T6→T7→T8. `fighterPalette` signature consistent T4→T5. `buildBeatTimeline(beat, presentationSeed)` consistent T6→T7→T8. `simulateFight(seed, script)` consistent T8→T9.

**Risks called out for the executor:** (1) T2 is the crux — thread `beats` through *every* existing return in `exchange.ts` without resetting, and keep the RNG-parity snapshot green (this is the "no second combat path" guarantee). (2) T4 must keep FighterAvatar byte-identical — lift the palette with the exact same `createRng` draw order. (3) Poses (T5) are hand-tuned; expect visual iteration in the Lab before the feel-gate.
