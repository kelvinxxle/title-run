# M19-B — Live Hybrid Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected stick-figure fight renderer with a legible, living **Hybrid Arena** — real-fighter photo heads on articulated, Tweened vector bodies — mounted as the standing fight view in `FightView`, driven by the already-merged verified `useBeatPlayback` engine.

**Architecture:** The verified `useBeatPlayback(beat, seed) → PlaybackState` engine (merged dormant in M19-A) is the single motion clock; it is **not modified in behavior**. A new **pure** `ArenaStage` renderer mounts two memoized `HybridRig`s and routes per-frame poses/flashes/shake. `HybridRig` maps each `PoseName` to an articulated `RigPose` and WAAPI-tweens joints on pose-name change (instant fallback under `prefers-reduced-motion`/jsdom). `FightView` selects `beats.at(-1)` as the current beat, drives the hook, mounts `ArenaStage`, and **locks all decision controls while `isPlaying`**. A move-family fix makes kicks render as kicks.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind + Vitest + jsdom. SVG rig. WAAPI (`element.animate`) for tweening. CSS keyframes for idle. No new dependencies.

## Global Constraints

- **TypeScript strict.** No `any`. Exhaustive `switch` over unions with a compile-time `assertNever(x: never)` helper.
- **Seeded determinism.** NO `Math.random` / `Date.now` in production code. The only permitted wall-clock is the pre-existing injectable `makeSeed` default in `src/App.tsx` and `src/screens/DraftScreen.tsx`. Presentation randomness derives from `presentationSeed` (which is `fightState.seed`). Idle animation is **CSS only** — no `rAF`, no clock API.
- **Do not change the verified engine's behavior.** `src/domain/**` is untouched except where explicitly stated (it is **not** touched in this plan). `useBeatPlayback`'s rAF/hitstop loop is not modified; only its `PlaybackState` output shape is *extended* additively (leg-flash flags).
- **Domain RNG parity pin stays green:** `opponent.headDamage === 36` (exchange.test.ts). Balance bands unchanged. These live in `src/domain` and this plan does not touch domain combat, so they must remain byte-identical in behavior.
- **One-way import:** `src/domain/**` must never import from `src/replay/**` or `src/components/**`. Verify with `grep -rn "from '.*replay" src/domain` → empty.
- **`prefers-reduced-motion`:** instant pose set (no WAAPI tween), no idle bob, playback resolves immediately (the hook already does this — do not regress it), controls unlock immediately.
- **GitHub Pages base path** `/title-run/`: every photo `href` MUST be `` `${import.meta.env.BASE_URL}fighters/${fighterId}.jpg` `` and MUST fall back to a procedural head on error or missing id.
- **Octagon Elite design system (anti-"AI-slop"):** all arena chrome/HUD colors, type, spacing, radius come from `src/theme/tokens.ts` — NO ad-hoc hex, NO off-system fonts. Canvas `surface #131313`; primary/belt `#f2ca50` (Championship Gold); intensity/damage `#960711` (blood-red) / `secondary #ffb4ac`; fonts `Anton` (uppercase headlines), `Archivo Narrow` (body), `Space Mono` (stats/numbers); **0px radius** (sharp edges). The arena is an **uncovered screen** (no mockup) — extend Octagon Elite from tokens, do not invent a new aesthetic. `src/theme/tokens.test.ts` guards the tokens; do not break it.
- **Determinism check:** `npx vitest run` twice must be byte-identical (same file/test counts, no snapshot churn).
- **Every commit** carries BOTH trailers:
  - `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`
  - `Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d`
- **Branch off fresh `origin/main`** (confirm `git rev-parse origin/main` = the merged M19-A HEAD `dd50431868984648970ba707704ccdf61592e57b` or later; the local checkout may be stale). One branch, one PR, **DO NOT MERGE** (feel-gate v2 + orchestrator re-verify gate it).

## Reference artifacts (read first)

- Design spec: `docs/superpowers/specs/2026-07-22-live-hybrid-arena-design.md` (committed by M19-A). Source of truth for *why* and *what*.
- Approved prototype: the rig geometry, the five seed poses, and the WAAPI driver are transcribed verbatim into Tasks 1, 4, 5 below. If anything is ambiguous, the prototype's `rigSVG`/`applyPose`/pose constants are the art contract.

## Architecture contract (how the pieces talk)

```
FightView (coordinator)
  currentBeat = fightState.beats.at(-1) ?? null
  play = useBeatPlayback(currentBeat, fightState.seed)     // per-frame PlaybackState (UNCHANGED engine)
  mode = arenaVisualMode(phase, play.isPlaying, currentBeat, outcome)
  controlsLocked = play.isPlaying                            // reduced-motion => isPlaying false immediately
  <ArenaStage mode play {...identities} />                   // pure renderer
  <panels ... disabled={controlsLocked} />

ArenaStage (pure; no state)
  owns the SHAKE layer (translateX = play.shakeX) and the HUD band (OUTSIDE shake)
  renders <HybridRig side="player"  pose={play.playerPose}   flash* facing="right" .../>
          <HybridRig side="opponent" pose={play.opponentPose} flash* facing="left"  .../>
  idle CSS class applied only when mode==='standing-idle'

HybridRig (memoized art unit)
  props: { side, fighterId?, name, archetype, cornerColor, pose: PoseName, facing,
           flashHead, flashBody, flashLeg, downed }
  target transforms per joint = RIG_POSES[pose]  (articulated model)
  on pose-name change: WAAPI element.animate(prev -> target, cubic-bezier(.34,1.2,.4,1), fill:forwards)
  reduced-motion OR no el.animate (jsdom): set target transform instantly
  single knockdown transform owner: root rotate applied ONCE when pose==='down'
  photo head: SVG <image href={BASE_URL}fighters/{id}.jpg> clipped to semantic id; onError => procedural head fragment
```

## File Structure

**Create:**
- `src/replay/moveFamily.ts` — exhaustive `StrikeId`/moveId → animation family. Pure. Unit-tested.
- `src/replay/rigPoses.ts` — articulated `RigPose` model + `RIG_POSES: Record<PoseName, RigPose>` (prototype seed values). Consumed only by `HybridRig`.
- `src/components/HybridRig.tsx` — the art unit (articulated vector body + photo head + tween + fallback + memo).
- `src/components/rigHeadFraming.ts` — per-fighter head focal map (SVG crop), default + overrides.
- `src/components/HybridRig.test.tsx` — rig structure, painted legs, counter-mirror, photo href + fallback, memo, target transforms.
- `src/screens/ArenaStage.tsx` — pure renderer: background/cage/HUD band + two rigs + shake layer + visual-mode.
- `src/screens/arenaVisualMode.ts` — pure `arenaVisualMode(...)` state-machine fn.
- `src/screens/ArenaStage.test.tsx` — visual-mode transitions, rig facing, shake layer, idle class.
- `src/screens/arena-idle.css` — idle keyframes layer (imported by ArenaStage).

**Modify:**
- `src/replay/poses.ts` — add 5 `PoseName`s (`punch-load`, `punch-contact`, `kick-load`, `kick-contact`, `hit-leg`) + their `POSES` entries (old model, keeps the dormant `FighterRig` compiling).
- `src/replay/timeline.ts` — replace `strikePose` with `moveFamily`; punch vs kick poses; extend `BeatEvent.zone` + `toZone` to `'legs'`; `legKick` → leg flash + `hit-leg` reaction.
- `src/replay/timeline.test.ts` — new move-family + leg-reaction assertions.
- `src/replay/useBeatPlayback.ts` — extend `PlaybackState` + `snapshotState`/`flashActive` with `flashLegPlayer`/`flashLegOpponent` (additive; rAF loop untouched).
- `src/replay/useBeatPlayback.test.tsx` — characterization snapshot updated (deliberate) + leg-flash assertion.
- `src/replay/FightReplay.tsx` — pass-through of the new leg-flash flags (dormant; keeps its tests green).
- `src/screens/FightView.tsx` — mount `ArenaStage`, drive hook, control-lock, HUD-timing hold.
- `src/screens/FightView.test.tsx` — control-lock, HUD-hold, settle/KO, mount tests.

**Do NOT touch:** `src/domain/**` (engine + balance + RNG parity), `src/components/FighterRig.tsx` (dormant; leave stable), `src/App.tsx` routing.

---

### Task 1: Pose names + articulated rig-pose table

**Files:**
- Modify: `src/replay/poses.ts`
- Create: `src/replay/rigPoses.ts`
- Test: `src/replay/rigPoses.test.ts`, `src/replay/poses.test.ts` (extend if it exists; else create)

**Interfaces:**
- Produces: `PoseName` now includes `'punch-load' | 'punch-contact' | 'kick-load' | 'kick-contact' | 'hit-leg'`. `RigPose` (articulated, all numeric) and `RIG_POSES: Record<PoseName, RigPose>` consumed by `HybridRig` (Task 4/5). `RigPose` fields: `torso, head, armLead, foreLead, armRear, foreRear, thighLead, shinLead, thighRear, shinRear` (degrees) + `bodyY, rigX` (px).
- Consumes: nothing new.

**Design note (deviation from spec §8, deliberate):** the spec says "add leg joints to `Pose`." The dormant `FighterRig` uses the old `Pose` model and must keep compiling/green. So we keep `poses.ts` `Pose` as-is (add only the 5 names + old-model entries) and put the articulated leg model in a **dedicated `RigPose` table** keyed by the same `PoseName`. Same intent, zero disturbance to the verified dormant renderer.

- [ ] **Step 1: Write the failing test for the extended `PoseName` + rig table**

Create `src/replay/rigPoses.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RIG_POSES, type RigPose } from './rigPoses';
import { POSES, type PoseName } from './poses';

const ALL_NAMES: PoseName[] = [
  'idle', 'guard', 'jab', 'cross', 'hook', 'slip', 'hit-head', 'hit-body',
  'reel', 'down', 'sig-load', 'sig-fire',
  'punch-load', 'punch-contact', 'kick-load', 'kick-contact', 'hit-leg',
];

describe('rig poses', () => {
  it('POSES (old model) has an entry for every PoseName incl. the 5 new ones', () => {
    for (const n of ALL_NAMES) expect(POSES[n]).toBeDefined();
  });

  it('RIG_POSES has an articulated entry (all 10 joints + bodyY + rigX) for every PoseName', () => {
    for (const n of ALL_NAMES) {
      const p: RigPose = RIG_POSES[n];
      for (const j of ['torso', 'head', 'armLead', 'foreLead', 'armRear', 'foreRear',
                       'thighLead', 'shinLead', 'thighRear', 'shinRear', 'bodyY', 'rigX'] as const) {
        expect(typeof p[j]).toBe('number');
      }
    }
  });

  it('kick-contact rotates the rear thigh forward relative to guard (a kick, not a punch)', () => {
    expect(RIG_POSES['kick-contact'].thighRear).toBeGreaterThan(RIG_POSES['guard'].thighRear);
  });

  it('down does not encode an 80deg torso (single knockdown owner is the rig root)', () => {
    expect(Math.abs(RIG_POSES['down'].torso)).toBeLessThan(45);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/replay/rigPoses.test.ts`
Expected: FAIL — `Cannot find module './rigPoses'`.

- [ ] **Step 3: Add the 5 pose names + old-model entries to `poses.ts`**

In `src/replay/poses.ts`, extend the union and the `POSES` record (append these 5 entries inside the existing object; values are the old `Pose` model — reasonable approximations so the dormant FighterRig still renders):

```ts
export type PoseName =
  | 'idle' | 'guard' | 'jab' | 'cross' | 'hook' | 'slip'
  | 'hit-head' | 'hit-body' | 'reel' | 'down' | 'sig-load' | 'sig-fire'
  | 'punch-load' | 'punch-contact' | 'kick-load' | 'kick-contact' | 'hit-leg';
```

Add to `POSES` (before the closing `};`):

```ts
  'punch-load':    { torso: -8,  headX: -2, headY: 0, leadArm: { rotate: 20, extend: 0.4 }, rearArm: { rotate: 50, extend: 0.5  }, lean: -4 },
  'punch-contact': { torso: 16,  headX: 3,  headY: 0, leadArm: { rotate: 70, extend: 0.4 }, rearArm: { rotate: -5, extend: 0.95 }, lean: 12 },
  'kick-load':     { torso: -6,  headX: -2, headY: 0, leadArm: { rotate: 40, extend: 0.4 }, rearArm: { rotate: 30, extend: 0.4  }, lean: -3 },
  'kick-contact':  { torso: 22,  headX: 4,  headY: 0, leadArm: { rotate: 50, extend: 0.4 }, rearArm: { rotate: 40, extend: 0.4  }, lean: 6  },
  'hit-leg':       { torso: 8,   headX: 6,  headY: 3, leadArm: { rotate: 50, extend: 0.4 }, rearArm: { rotate: 40, extend: 0.4  }, lean: 4  },
```

- [ ] **Step 4: Create `src/replay/rigPoses.ts` (articulated model, prototype seed values)**

```ts
import type { PoseName } from './poses';

export interface RigPose {
  torso: number; head: number;
  armLead: number; foreLead: number;
  armRear: number; foreRear: number;
  thighLead: number; shinLead: number;
  thighRear: number; shinRear: number;
  bodyY: number; rigX: number;
}

// Seed values transcribed from the user-approved prototype (GUARD / A_LOAD / A_CONTACT /
// T_HURT / T_REEL). Kick + hit-leg values are art seeds — TUNE IN FEEL-GATE v2 (Task 12).
const GUARD: RigPose        = { torso: 6,   head: 0,  armLead: 34, foreLead: 128, armRear: 24, foreRear: 126, thighLead: 6,  shinLead: -8,  thighRear: -8,  shinRear: 6,   bodyY: 0,  rigX: 0 };
const PUNCH_LOAD: RigPose    = { torso: -10, head: -4, armLead: 30, foreLead: 132, armRear: 20, foreRear: 150, thighLead: 2,  shinLead: -6,  thighRear: -16, shinRear: 22,  bodyY: 5,  rigX: -3 };
const PUNCH_CONTACT: RigPose = { torso: 18,  head: 6,  armLead: 96, foreLead: 4,   armRear: 20, foreRear: 120, thighLead: 2,  shinLead: -2,  thighRear: 16,  shinRear: -24, bodyY: -2, rigX: -6 };
const KICK_LOAD: RigPose     = { torso: -8,  head: -2, armLead: 40, foreLead: 120, armRear: 30, foreRear: 120, thighLead: 4,  shinLead: -6,  thighRear: -40, shinRear: 70,  bodyY: 2,  rigX: -2 };
const KICK_CONTACT: RigPose  = { torso: 24,  head: 8,  armLead: 50, foreLead: 110, armRear: 40, foreRear: 110, thighLead: 6,  shinLead: -4,  thighRear: 62,  shinRear: 8,   bodyY: -2, rigX: -6 };
const HURT: RigPose          = { torso: 20,  head: 30, armLead: 44, foreLead: 96,  armRear: 52, foreRear: 104, thighLead: 18, shinLead: -22, thighRear: 24,  shinRear: -12, bodyY: 6,  rigX: 14 };
const REEL: RigPose          = { torso: 12,  head: 16, armLead: 38, foreLead: 110, armRear: 34, foreRear: 112, thighLead: 8,  shinLead: -12, thighRear: 12,  shinRear: -6,  bodyY: 3,  rigX: 7 };
const HIT_LEG: RigPose       = { torso: 8,   head: 8,  armLead: 40, foreLead: 110, armRear: 34, foreRear: 112, thighLead: 34, shinLead: -34, thighRear: 6,   shinRear: -4,  bodyY: 4,  rigX: 8 };
// Collapsed pose for knockdown. NO big torso angle here — the 80deg root rotation is applied
// ONCE by HybridRig when pose==='down' (single transform owner; design §9).
const DOWN: RigPose          = { torso: 8,   head: 20, armLead: 120, foreLead: 60, armRear: 110, foreRear: 60, thighLead: 70, shinLead: -30, thighRear: 60, shinRear: -20, bodyY: 10, rigX: 0 };
const SIG_LOAD: RigPose      = { torso: -12, head: -4, armLead: 30, foreLead: 120, armRear: 30, foreRear: 150, thighLead: 2,  shinLead: -6,  thighRear: -18, shinRear: 24,  bodyY: 5,  rigX: -4 };
const SIG_FIRE: RigPose      = { torso: 20,  head: 8,  armLead: 100, foreLead: 2,  armRear: 18,  foreRear: 118, thighLead: 2, shinLead: -2,  thighRear: 18,  shinRear: -26, bodyY: -2, rigX: -8 };
const SLIP: RigPose          = { torso: -6,  head: -10, armLead: 40, foreLead: 120, armRear: 24, foreRear: 120, thighLead: 4, shinLead: -6, thighRear: -6, shinRear: 4,  bodyY: 2,  rigX: -4 };

export const RIG_POSES: Record<PoseName, RigPose> = {
  idle: GUARD,
  guard: GUARD,
  jab: PUNCH_CONTACT,
  cross: PUNCH_CONTACT,
  hook: PUNCH_CONTACT,
  slip: SLIP,
  'hit-head': HURT,
  'hit-body': HURT,
  reel: REEL,
  down: DOWN,
  'sig-load': SIG_LOAD,
  'sig-fire': SIG_FIRE,
  'punch-load': PUNCH_LOAD,
  'punch-contact': PUNCH_CONTACT,
  'kick-load': KICK_LOAD,
  'kick-contact': KICK_CONTACT,
  'hit-leg': HIT_LEG,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/replay/rigPoses.test.ts`
Expected: PASS (4/4).

- [ ] **Step 6: Full suite + typecheck (nothing regressed)**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green; `tsc` exit 0. The dormant `FighterRig` still compiles because `POSES` has all names.

- [ ] **Step 7: Commit**

```bash
git add src/replay/poses.ts src/replay/rigPoses.ts src/replay/rigPoses.test.ts
git commit -m "feat(M19-B): add kick/punch/hit-leg pose names + articulated RIG_POSES table

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 2: Exhaustive move-family mapping + kick/leg timeline events

**Files:**
- Create: `src/replay/moveFamily.ts`
- Modify: `src/replay/timeline.ts`
- Test: `src/replay/moveFamily.test.ts`, `src/replay/timeline.test.ts`

**Interfaces:**
- Produces: `moveFamily(moveId: string | null, moveClass: BeatMoveClass): MoveFamily` where `type MoveFamily = 'punch' | 'kick' | 'takedown' | 'signature'`. `buildBeatTimeline` now emits `punch-load`/`punch-contact` for punches, `kick-load`/`kick-contact` for kicks, and `hit-leg` + `zone:'legs'` for `legKick`. `BeatEvent.zone` widened to `'head' | 'body' | 'legs'`.
- Consumes: `StrikeId` (`src/domain/combat/strikes.ts`), `BeatMoveClass`/`ResolvedBeat` (`src/domain/combat/beat.ts`), `PoseName` (Task 1).

**Confirmed bug being fixed:** `timeline.ts:33 strikePose()` maps only `jab/cross/hook` → everything else (`powerPunch`, `bodyKick`, `legKick`, `knee`, `elbow`) renders as a `'cross'` punch. `cross`/`hook` are not even production moves.

- [ ] **Step 1: Write the failing move-family test**

Create `src/replay/moveFamily.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { moveFamily } from './moveFamily';
import { STRIKE_PALETTE } from '../domain/combat/strikes';

describe('moveFamily', () => {
  it('maps every production StrikeId to a family (total function, no fallthrough to punch)', () => {
    const map: Record<string, string> = {
      jab: 'punch', powerPunch: 'punch', elbow: 'punch',
      bodyKick: 'kick', legKick: 'kick', knee: 'kick',
    };
    for (const id of STRIKE_PALETTE) {
      expect(moveFamily(id, 'strike')).toBe(map[id]);
    }
  });

  it('routes signature and takedown by moveClass, never faking a punch', () => {
    expect(moveFamily('check-hook', 'signature')).toBe('signature');
    expect(moveFamily('double-leg', 'takedown')).toBe('takedown');
    expect(moveFamily(null, 'ground')).toBe('takedown');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/replay/moveFamily.test.ts`
Expected: FAIL — `Cannot find module './moveFamily'`.

- [ ] **Step 3: Implement `src/replay/moveFamily.ts`**

```ts
import type { StrikeId } from '../domain/combat/strikes';
import type { BeatMoveClass } from '../domain/combat/beat';

export type MoveFamily = 'punch' | 'kick' | 'takedown' | 'signature';

function assertNever(x: never): never {
  throw new Error(`Unhandled StrikeId: ${String(x)}`);
}

function strikeFamily(id: StrikeId): MoveFamily {
  switch (id) {
    case 'jab':
    case 'powerPunch':
    case 'elbow':
      return 'punch';
    case 'bodyKick':
    case 'legKick':
    case 'knee':
      return 'kick';
    default:
      return assertNever(id);
  }
}

const STRIKE_IDS: ReadonlySet<string> = new Set([
  'jab', 'powerPunch', 'elbow', 'bodyKick', 'legKick', 'knee',
]);

export function moveFamily(moveId: string | null, moveClass: BeatMoveClass): MoveFamily {
  if (moveClass === 'signature') return 'signature';
  if (moveClass === 'takedown' || moveClass === 'ground') return 'takedown';
  if (moveId !== null && STRIKE_IDS.has(moveId)) return strikeFamily(moveId as StrikeId);
  // Non-strike, non-signature, non-takedown moveClasses (advance/evade/counter/impact/knockdown)
  // are punch-family by default for the standing hand exchange.
  return 'punch';
}
```

- [ ] **Step 4: Run move-family test to pass**

Run: `npx vitest run src/replay/moveFamily.test.ts`
Expected: PASS (2/2). (The `assertNever` default gives a **compile-time** guarantee: adding a new `StrikeId` without a case fails `tsc`.)

- [ ] **Step 5: Write failing timeline tests for kick + leg reaction**

Add to `src/replay/timeline.test.ts` (import helpers already present in that file; construct a `ResolvedBeat` via the existing test factory or inline). Add:

```ts
import { buildBeatTimeline } from './timeline';
import { buildResolvedBeat } from '../domain/combat/beat';

function legKickBeat() {
  return buildResolvedBeat({
    round: 1, exchange: 1, winner: 'player', dominance: 4,
    moveClass: 'strike', moveId: 'legKick', outcome: 'landed', target: 'legs',
    deltas: { playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
              opponentHead: 0, opponentBody: 0, opponentLeg: 18, opponentStamina: 2 },
    status: { playerBecameRocked: false, opponentBecameRocked: false, playerGassed: false, opponentGassed: false },
    signatureId: null, isFinish: false, finishMethod: null,
  });
}

describe('M19-B timeline: kicks and legs', () => {
  it('legKick emits a leg-zone flash and a hit-leg reaction (not a body reaction)', () => {
    const { events } = buildBeatTimeline(legKickBeat(), 'seed');
    expect(events.some(e => e.kind === 'flash' && e.zone === 'legs')).toBe(true);
    expect(events.some(e => e.kind === 'reaction' && e.pose === 'hit-leg')).toBe(true);
  });

  it('a kick actor uses kick-load/kick-contact poses, not punch poses', () => {
    const { events } = buildBeatTimeline(legKickBeat(), 'seed');
    const actorPoses = events.filter(e => e.actor === 'player' && e.pose != null).map(e => e.pose);
    expect(actorPoses).toContain('kick-load');
    expect(actorPoses).toContain('kick-contact');
    expect(actorPoses).not.toContain('cross');
  });

  it('a jab actor uses punch poses', () => {
    const beat = buildResolvedBeat({
      round: 1, exchange: 1, winner: 'player', dominance: 3,
      moveClass: 'strike', moveId: 'jab', outcome: 'landed', target: 'head',
      deltas: { playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
                opponentHead: 12, opponentBody: 0, opponentLeg: 0, opponentStamina: 1 },
      status: { playerBecameRocked: false, opponentBecameRocked: false, playerGassed: false, opponentGassed: false },
      signatureId: null, isFinish: false, finishMethod: null,
    });
    const { events } = buildBeatTimeline(beat, 'seed');
    const actorPoses = events.filter(e => e.actor === 'player' && e.pose != null).map(e => e.pose);
    expect(actorPoses).toContain('punch-load');
    expect(actorPoses).toContain('punch-contact');
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/replay/timeline.test.ts`
Expected: FAIL — kicks currently emit `'cross'`; no `'legs'` zone; no `'hit-leg'`.

- [ ] **Step 7: Rewrite the strike/kick branch in `timeline.ts`**

Widen the event zone type and the `toZone` helper, delete `strikePose`, and rebuild the landed/blocked/evaded branches to be family-aware. Replace lines 5-36 and the `else` landed branch:

```ts
// (top of file) widen the flash/impact zone
export interface BeatEvent {
  tMs: number;
  durMs: number;
  kind: BeatEventKind;
  actor: BeatActor;
  pose?: PoseName;
  intensity?: number;
  zone?: 'head' | 'body' | 'legs';
}
```

```ts
import { moveFamily } from './moveFamily';

function toZone(target: 'head' | 'body' | 'legs' | null): 'head' | 'body' | 'legs' {
  if (target === 'legs') return 'legs';
  if (target === 'head') return 'head';
  return 'body';
}

// wind-up + contact poses per family
function loadPose(family: 'punch' | 'kick'): PoseName {
  return family === 'kick' ? 'kick-load' : 'punch-load';
}
function contactPose(family: 'punch' | 'kick'): PoseName {
  return family === 'kick' ? 'kick-contact' : 'punch-contact';
}
```

In `buildBeatTimeline`, for the `evaded`, `blocked`, and landed branches, replace `strikePose(beat.moveId)` usage. Compute once near the top of the function body:

```ts
  const family = moveFamily(beat.moveId, beat.moveClass);
  const strikeFam: 'punch' | 'kick' = family === 'kick' ? 'kick' : 'punch';
```

Then:
- `evaded` branch: `push('windup', 70, beat.actorId, { pose: loadPose(strikeFam) });` (rest unchanged).
- `blocked` branch: `push('windup', 70, beat.actorId, { pose: loadPose(strikeFam) });` then keep `push('strike', 60, beat.actorId);` — add the contact pose: `push('strike', 60, beat.actorId, { pose: contactPose(strikeFam) });`.
- landed `else` branch: replace the windup/strike/reaction poses:

```ts
    const zone = toZone(beat.target);
    const rawDelta = zone === 'head'
      ? (beat.targetId === 'opponent' ? beat.deltas.opponentHead : beat.deltas.playerHead)
      : zone === 'legs'
        ? (beat.targetId === 'opponent' ? beat.deltas.opponentLeg : beat.deltas.playerLeg)
        : (beat.targetId === 'opponent' ? beat.deltas.opponentBody : beat.deltas.playerBody);
    const intensity = Math.min(1, rawDelta / 30);
    const reactionPose: PoseName = targetBecameRocked(beat)
      ? 'reel'
      : zone === 'legs' ? 'hit-leg'
      : zone === 'head' ? 'hit-head'
      : 'hit-body';

    push('windup', windupDur, beat.actorId, { pose: loadPose(strikeFam) });
    push('strike', 80, beat.actorId, { pose: contactPose(strikeFam) });
    push('impact', 60, beat.targetId, { zone, intensity });
    push('flash', 40, beat.targetId, { zone, intensity });
    push('shake', 50, beat.actorId, { intensity: intensity * 0.7 });
    push('reaction', 100, beat.targetId, { pose: reactionPose });
```

(Keep the `isFinish` knockdown/hitstop block and the final `recover` unchanged.)

- [ ] **Step 8: Run timeline + move-family tests**

Run: `npx vitest run src/replay/timeline.test.ts src/replay/moveFamily.test.ts`
Expected: PASS. Legacy timeline tests that asserted `'cross'` poses must be updated to the new family poses (update those assertions in the same file — the old poses were the bug).

- [ ] **Step 9: Commit**

```bash
git add src/replay/moveFamily.ts src/replay/moveFamily.test.ts src/replay/timeline.ts src/replay/timeline.test.ts
git commit -m "fix(M19-B): exhaustive move-family mapping; kicks render as kicks, legKick hits the leg

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 3: Surface leg-flash in `PlaybackState` (additive; engine loop unchanged)

**Files:**
- Modify: `src/replay/useBeatPlayback.ts`, `src/replay/FightReplay.tsx`
- Test: `src/replay/useBeatPlayback.test.tsx`

**Interfaces:**
- Produces: `PlaybackState` gains `flashLegPlayer: boolean` and `flashLegOpponent: boolean`. Consumed by `ArenaStage`/`HybridRig` (Tasks 4-6).
- Consumes: `BeatEvent.zone === 'legs'` (Task 2).

**Constraint:** Do NOT change the rAF/hitstop loop, refs, deps, cleanup, or reduced-motion path. This is a purely additive output field. The characterization snapshot WILL change (a new field appears + kicks now emit different poses); that change is deliberate — regenerate and eyeball it.

- [ ] **Step 1: Add a failing leg-flash assertion**

In `src/replay/useBeatPlayback.test.tsx`, add (using the existing rAF harness in that file — pump frames for a `legKick` beat):

```ts
it('surfaces a leg flash for a legKick landed beat during its flash window', async () => {
  // build a legKick ResolvedBeat (see timeline.test factory), render the hook via the harness,
  // pump to the flash timestamp, and assert:
  expect(state.flashLegOpponent).toBe(true);
  expect(state.flashHeadOpponent).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/replay/useBeatPlayback.test.tsx`
Expected: FAIL — `flashLegOpponent` does not exist on `PlaybackState`.

- [ ] **Step 3: Extend `PlaybackState`, `IDLE_STATE`, `flashActive` calls, `snapshotState`, and the reduced-motion object**

In `useBeatPlayback.ts`:
- Add to `PlaybackState`: `flashLegPlayer: boolean; flashLegOpponent: boolean;`
- Add to `IDLE_STATE`: `flashLegPlayer: false, flashLegOpponent: false,`
- `flashActive` already takes a `zone` param typed `'head' | 'body'`; widen it to `'head' | 'body' | 'legs'`.
- In `snapshotState`, add:
  ```ts
  flashLegPlayer: flashActive(events, 'player', 'legs', t),
  flashLegOpponent: flashActive(events, 'opponent', 'legs', t),
  ```
- In the reduced-motion early-return object, add `flashLegPlayer: false, flashLegOpponent: false,`.

- [ ] **Step 4: Pass-through in the dormant `FightReplay.tsx`**

`FightReplay` renders `FighterRig`, which has no leg-flash prop. Leave `FighterRig` untouched; simply do not break `FightReplay`. No change needed unless `tsc` complains — if it does, thread `flashLeg={s.flashLegPlayer}` only if `FighterRig` grows the prop (it should NOT in this plan). Confirm `FightReplay` still compiles unchanged.

- [ ] **Step 5: Regenerate the characterization snapshot deliberately**

Run: `npx vitest run src/replay/useBeatPlayback.test.tsx -u`
Then open the updated `toMatchInlineSnapshot` and eyeball: the new `flashLeg*` fields appear; punch beats are unaffected; kick beats now show kick poses. Confirm nothing unexpected changed.

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/replay && npx tsc --noEmit`
Expected: green; existing `FightReplay.test.tsx` still passes (dormant behavior intact).

- [ ] **Step 7: Commit**

```bash
git add src/replay/useBeatPlayback.ts src/replay/useBeatPlayback.test.tsx src/replay/FightReplay.tsx
git commit -m "feat(M19-B): surface leg-flash flags in PlaybackState (additive; engine loop unchanged)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 4: `HybridRig` — articulated vector body + Tweened motion + facing (procedural head only)

**Files:**
- Create: `src/components/HybridRig.tsx`, `src/components/HybridRig.test.tsx`

**Interfaces:**
- Produces: `<HybridRig>` React component. Props:
  ```ts
  export interface HybridRigProps {
    side: 'player' | 'opponent';
    fighterId?: string;          // omitted => procedural head (custom player)
    name: string;
    archetype: Archetype;
    cornerColor: string;         // glove/trunk tint (blood-red player / blue opponent by default)
    pose: PoseName;
    facing: 'left' | 'right';    // un-mirrored rig faces LEFT; player faces right => mirrored
    flashHead: boolean;
    flashBody: boolean;
    flashLeg: boolean;
    downed: boolean;
  }
  ```
- Consumes: `RIG_POSES` (Task 1), `PoseName` (Task 1), `Archetype`/`fighterPalette` (`src/components/fighterPalette.ts`), `tokens` (`src/theme/tokens.ts`).

**Art contract (from the approved prototype — transcribe faithfully):**
- Local space: each rig lives in a `translate(...)` group; body ~180 wide, ground ~y=300. BASE joint pivots and segment shapes are the prototype's.
- **Painted legs, not floating shorts:** thigh = trunk color (long shorts to knee), shin = bare skin + dark foot; hip yoke path in trunk color on the pelvis.
- **Corner-colored mitt gloves** (rounded rect + thumb + knuckle lines).
- **Facing:** un-mirrored (opponent) faces LEFT. `facing==='right'` (player) wraps the whole rig in `translate(180,0) scale(-1,1)`; the head group gets a **counter-mirror** `scale(-1,1)` so the (later) photo/head isn't backwards.
- **Single knockdown owner:** when `downed` (pose==='down'), apply ONE root `rotate(80, 90, 250)` — do NOT also bake 80° into the pose torso (Task 1 kept `down.torso` small).
- **Motion:** target joint transforms are set declaratively every render (instant + jsdom-correct). On pose-name change, a `useLayoutEffect` WAAPI-tweens each joint from the previous pose to the target with `cubic-bezier(.34,1.2,.4,1)`, `fill:'forwards'`. Skipped when `prefers-reduced-motion` OR `el.animate` is unavailable (jsdom) → instant.
- **Idle bob:** render a `<g className="rig-bob">` wrapper; the CSS keyframe (Task 7) targets `.arena-idle .rig-bob`. HybridRig itself adds no animation clock.

- [ ] **Step 1: Write failing structure/motion tests**

Create `src/components/HybridRig.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HybridRig } from './HybridRig';

function renderRig(overrides: Partial<React.ComponentProps<typeof HybridRig>> = {}) {
  return render(
    <svg>
      <HybridRig
        side="player" name="Test Fighter" archetype="striker" cornerColor="#e23b2e"
        pose="guard" facing="right"
        flashHead={false} flashBody={false} flashLeg={false} downed={false}
        {...overrides}
      />
    </svg>,
  );
}

describe('HybridRig body', () => {
  it('renders a rig root with the side + current pose as data attributes', () => {
    const { container } = renderRig({ pose: 'kick-contact' });
    const root = container.querySelector('[data-rig="player"]');
    expect(root).not.toBeNull();
    expect(root!.getAttribute('data-pose')).toBe('kick-contact');
  });

  it('paints the thighs in the trunk color (no floating shorts panel)', () => {
    const { container } = renderRig({ cornerColor: '#e23b2e' });
    const thigh = container.querySelector('[data-part="thighLead"]');
    expect(thigh).not.toBeNull();
    // trunk color is derived from the palette, not the raw cornerColor; assert it is a solid fill
    expect(thigh!.getAttribute('fill')).toMatch(/^#/);
  });

  it('mirrors the rig when facing right and counter-mirrors the head group', () => {
    const { container } = renderRig({ facing: 'right' });
    const facing = container.querySelector('[data-layer="facing"]');
    expect(facing!.getAttribute('transform')).toContain('scale(-1,1)');
    const head = container.querySelector('[data-j="head"]');
    expect(head!.getAttribute('transform')).toContain('scale(-1,1)');
  });

  it('does NOT mirror when facing left (opponent)', () => {
    const { container } = renderRig({ side: 'opponent', facing: 'left' });
    const facing = container.querySelector('[data-layer="facing"]');
    expect(facing!.getAttribute('transform') ?? '').not.toContain('scale(-1,1)');
  });

  it('sets each joint target transform from RIG_POSES (instant path in jsdom)', () => {
    const { container } = renderRig({ pose: 'kick-contact' });
    const thighRear = container.querySelector('[data-j="thighRear"]');
    // kick-contact thighRear = 62deg (see rigPoses.ts)
    expect(thighRear!.getAttribute('transform')).toContain('rotate(62');
  });

  it('applies a single 80deg root rotation when downed (no double-rotation)', () => {
    const { container } = renderRig({ pose: 'down', downed: true });
    const root = container.querySelector('[data-rig="player"]');
    const t = root!.getAttribute('transform') ?? '';
    expect(t).toContain('rotate(80');
    // torso pose itself stays shallow (Task 1): assert torso not also ~80
    const torso = container.querySelector('[data-j="torso"]');
    expect(torso!.getAttribute('transform')).not.toContain('rotate(80');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/HybridRig.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/HybridRig.tsx` (procedural head this task; photo head in Task 5)**

```tsx
import { memo, useLayoutEffect, useRef } from 'react';
import { RIG_POSES, type RigPose } from '../replay/rigPoses';
import type { PoseName } from '../replay/poses';
import { fighterPalette } from './fighterPalette';
import type { Archetype } from '../domain/combat/stats';

export interface HybridRigProps {
  side: 'player' | 'opponent';
  fighterId?: string;
  name: string;
  archetype: Archetype;
  cornerColor: string;
  pose: PoseName;
  facing: 'left' | 'right';
  flashHead: boolean;
  flashBody: boolean;
  flashLeg: boolean;
  downed: boolean;
}

// BASE joint pivots (local space) — transcribed from the approved prototype.
const BASE: Record<keyof Omit<RigPose, 'bodyY' | 'rigX'>, [number, number]> = {
  torso: [90, 200], head: [0, -130],
  armLead: [18, -80], foreLead: [0, 36],
  armRear: [-18, -80], foreRear: [0, 36],
  thighLead: [100, 200], shinLead: [0, 48],
  thighRear: [80, 200], shinRear: [0, 48],
};
const JOINTS = Object.keys(BASE) as (keyof typeof BASE)[];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function jointTransform(side: 'player' | 'opponent', joint: keyof typeof BASE, deg: number): string {
  const [bx, by] = BASE[joint];
  const headExtra = joint === 'head' && side === 'player' ? ' scale(-1,1)' : '';
  return `translate(${bx},${by}) rotate(${deg},0,0)${headExtra}`;
}

export const HybridRig = memo(function HybridRig(props: HybridRigProps) {
  const { side, name, archetype, cornerColor, pose, facing, flashHead, flashBody, flashLeg, downed } = props;
  const rootRef = useRef<SVGGElement | null>(null);
  const prevPose = useRef<PoseName>(pose);

  const pal = fighterPalette(props.fighterId ?? name, archetype);
  const trunk = cornerColor;                       // corner-colored trunk (painted legs)
  const skin = pal.skin;
  const glove = cornerColor;
  const torsoFill = '#33333d';
  const rp = RIG_POSES[pose];

  // Tween on pose-name change (browser only; jsdom/reduced-motion => instant target already in markup).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prevPose.current === pose) return;
    const from = RIG_POSES[prevPose.current];
    prevPose.current = pose;
    if (prefersReducedMotion()) return;
    for (const j of JOINTS) {
      const el = root.querySelector(`[data-j="${j}"]`) as SVGGElement | null;
      if (!el || typeof el.animate !== 'function') continue;
      el.animate(
        [{ transform: jointTransform(side, j, from[j]) }, { transform: jointTransform(side, j, rp[j]) }],
        { duration: 150, easing: 'cubic-bezier(.34,1.2,.4,1)', fill: 'forwards' },
      );
    }
  }, [pose, side, rp]);

  const facingTransform = facing === 'right' ? 'translate(180,0) scale(-1,1)' : '';
  const rootTransform = `translate(${rp.rigX},0)` + (downed ? ' rotate(80,90,250)' : '');

  const thigh = (part: string) => (
    <rect data-part={part} x={-7} y={-2} width={14} height={50} rx={0} fill={trunk} />
  );
  const shin = () => (
    <>
      <rect x={-6} y={-2} width={12} height={46} rx={0} fill={skin} />
      <path d="M-7,43 L16,41 L17,51 L-8,52 Z" fill="#111" />
    </>
  );
  const glv = () => (
    <g>
      <rect x={-10} y={23} width={20} height={23} rx={0} fill={glove} />
      <rect x={6} y={27} width={8} height={12} rx={0} fill={glove} />
      <rect x={-8} y={29} width={16} height={3.5} fill="rgba(0,0,0,.30)" />
      <rect x={-8} y={35} width={16} height={3} fill="rgba(0,0,0,.22)" />
    </g>
  );
  const upper = () => <rect x={-6} y={-4} width={12} height={40} rx={0} fill={skin} />;
  const fore = () => (<><rect x={-5} y={-2} width={10} height={30} rx={0} fill={skin} />{glv()}</>);

  // Procedural head fragment (Task 5 swaps a photo <image> in front of this when fighterId resolves).
  const head = (
    <g data-j="head" transform={jointTransform(side, 'head', rp.head)}>
      <circle cx={0} cy={0} r={33} fill="#0b0b0d" />
      <circle cx={0} cy={0} r={30} fill={skin} />
      <circle cx={0} cy={0} r={30} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={2} />
      {flashHead && <circle data-flash="head" cx={0} cy={0} r={30} fill="#fff" opacity={0.55} />}
    </g>
  );

  return (
    <g data-layer="facing" transform={facingTransform}>
      <g ref={rootRef} data-rig={side} data-pose={pose} transform={rootTransform}>
        <ellipse cx={90} cy={288} rx={46} ry={12} fill="rgba(0,0,0,.35)" />
        <g className="rig-bob">
          <g data-part="body" transform={`translate(0,${rp.bodyY})`}>
            <g data-j="thighRear" transform={jointTransform(side, 'thighRear', rp.thighRear)}>
              {thigh('thighRear')}
              <g data-j="shinRear" transform={jointTransform(side, 'shinRear', rp.shinRear)}>{shin()}</g>
            </g>
            <g data-j="thighLead" transform={jointTransform(side, 'thighLead', rp.thighLead)}>
              {thigh('thighLead')}
              <g data-j="shinLead" transform={jointTransform(side, 'shinLead', rp.shinLead)}>{shin()}</g>
            </g>
            <path d="M71,195 Q90,191 109,195 L108,214 Q90,219 72,214 Z" fill={trunk} />
            {flashLeg && <rect data-flash="leg" x={62} y={196} width={56} height={70} fill="#fff" opacity={0.4} />}
            <g data-j="torso" transform={jointTransform(side, 'torso', rp.torso)}>
              <g data-j="armRear" transform={jointTransform(side, 'armRear', rp.armRear)}>
                {upper()}
                <g data-j="foreRear" transform={jointTransform(side, 'foreRear', rp.foreRear)}>{fore()}</g>
              </g>
              <path d="M-17,2 L-22,-78 Q0,-90 22,-78 L17,2 Q0,8 -17,2 Z" fill={torsoFill} />
              {flashBody && <rect data-flash="body" x={-22} y={-90} width={44} height={98} fill="#fff" opacity={0.4} />}
              <rect x={-7} y={-98} width={14} height={22} rx={0} fill={skin} />
              <g data-j="armLead" transform={jointTransform(side, 'armLead', rp.armLead)}>
                {upper()}
                <g data-j="foreLead" transform={jointTransform(side, 'foreLead', rp.foreLead)}>{fore()}</g>
              </g>
              {head}
            </g>
          </g>
        </g>
      </g>
    </g>
  );
});
```

> Note: `rx={0}` everywhere — Octagon Elite sharp edges. `fighterPalette` import path/shape must be confirmed against the merged file; if its signature differs, adapt the `pal.skin` read (only `skin` is used here).

- [ ] **Step 4: Run tests to pass**

Run: `npx vitest run src/components/HybridRig.test.tsx`
Expected: PASS (6/6). If `matchMedia` is undefined in jsdom setup, the `prefersReducedMotion()` guard already handles it (returns false); the instant target transforms are in the markup regardless.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/components/HybridRig.tsx src/components/HybridRig.test.tsx
git commit -m "feat(M19-B): HybridRig articulated vector body + Tweened motion + facing (procedural head)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 5: `HybridRig` — photo head (base-prefixed `<image>` + focal map + onError fallback + memo)

**Files:**
- Modify: `src/components/HybridRig.tsx`
- Create: `src/components/rigHeadFraming.ts`
- Test: `src/components/HybridRig.test.tsx` (extend)

**Interfaces:**
- Produces: photo head rendering + `rigHeadFraming(fighterId): { y: number; scale: number }` focal map (default `{ y: -40, scale: 1 }` + a few per-fighter overrides). Deterministic semantic clip ids (`rig-clip-player` / `rig-clip-opponent`), never `useId()`.
- Consumes: `import.meta.env.BASE_URL`, `rigHeadFraming`.

**Contract:**
- With a `fighterId`: render `<image href={`${import.meta.env.BASE_URL}fighters/${fighterId}.jpg`} clipPath="url(#rig-clip-{side})" preserveAspectRatio="xMidYMin slice">` inside the head group, framed by `rigHeadFraming`. On `onError`, set local state → fall back to the procedural head fragment (Task 4).
- Without a `fighterId` (custom player) OR after an error: procedural head. Same crop/border/scale so the custom head reads intentional, not broken (design §13).
- Photo still rotates with the head group (counter-mirror only affects facing, applied to the whole head group as in Task 4).
- `React.memo` (already applied in Task 4) prevents per-frame shake (owned by ArenaStage) from reconciling the rig.

- [ ] **Step 1: Write failing photo/fallback tests**

Add to `src/components/HybridRig.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react';

describe('HybridRig photo head', () => {
  it('renders a base-prefixed photo href when fighterId is given', () => {
    const { container } = renderRig({ fighterId: 'conor-mcgregor' });
    const img = container.querySelector('image');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('href')).toBe('/title-run/fighters/conor-mcgregor.jpg');
  });

  it('falls back to the procedural head on image error', () => {
    const { container } = renderRig({ fighterId: 'conor-mcgregor' });
    const img = container.querySelector('image')!;
    fireEvent.error(img);
    expect(container.querySelector('image')).toBeNull();          // photo gone
    expect(container.querySelector('[data-j="head"] circle')).not.toBeNull(); // procedural head shown
  });

  it('uses the procedural head (no image) when fighterId is omitted (custom player)', () => {
    const { container } = renderRig({ fighterId: undefined });
    expect(container.querySelector('image')).toBeNull();
  });

  it('uses deterministic semantic clip ids (no useId churn)', () => {
    const { container: a } = renderRig({ side: 'player', fighterId: 'jon-jones' });
    const { container: b } = renderRig({ side: 'player', fighterId: 'jon-jones' });
    const idA = a.querySelector('clipPath')!.getAttribute('id');
    const idB = b.querySelector('clipPath')!.getAttribute('id');
    expect(idA).toBe('rig-clip-player');
    expect(idB).toBe('rig-clip-player');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/HybridRig.test.tsx`
Expected: FAIL — no `<image>`/`<clipPath>` yet.

- [ ] **Step 3: Create `src/components/rigHeadFraming.ts`**

```ts
export interface RigHeadFrame { y: number; scale: number; }

const DEFAULT: RigHeadFrame = { y: -40, scale: 1 };

// Per-fighter vertical/scale nudges so the face sits in the r=30 circle. Extend as feel-gate
// review of all 38 photos requires (Task 12). Keys are roster ids.
const OVERRIDES: Record<string, RigHeadFrame> = {
  // 'francis-ngannou': { y: -44, scale: 1.05 },
};

export function rigHeadFraming(fighterId: string): RigHeadFrame {
  return OVERRIDES[fighterId] ?? DEFAULT;
}
```

- [ ] **Step 4: Add photo head + fallback state to `HybridRig.tsx`**

- Add `import { useState } from 'react';` and `import { rigHeadFraming } from './rigHeadFraming';`.
- Inside the component: `const [imgErrored, setImgErrored] = useState(false);` and reset on `fighterId` change via a keyed effect OR by keying the `<image>` with `key={fighterId}` and tracking a `failedId` (mirror the merged `FighterImage` pattern):
  ```ts
  const [failedId, setFailedId] = useState<string | null>(null);
  const showPhoto = props.fighterId != null && failedId !== props.fighterId;
  ```
- Replace the `head` fragment's inner content so the photo (when `showPhoto`) renders in front of the procedural circle, clipped:
  ```tsx
  const clipId = `rig-clip-${side}`;
  const frame = props.fighterId ? rigHeadFraming(props.fighterId) : { y: -40, scale: 1 };
  const head = (
    <g data-j="head" transform={jointTransform(side, 'head', rp.head)}>
      <defs>
        <clipPath id={clipId}><circle cx={0} cy={0} r={30} /></clipPath>
      </defs>
      <circle cx={0} cy={0} r={33} fill="#0b0b0d" />
      {showPhoto ? (
        <image
          href={`${import.meta.env.BASE_URL}fighters/${props.fighterId}.jpg`}
          x={-33 * frame.scale} y={frame.y} width={66 * frame.scale} height={80 * frame.scale}
          clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMin slice"
          onError={() => setFailedId(props.fighterId ?? null)}
        />
      ) : (
        <circle cx={0} cy={0} r={30} fill={skin} />
      )}
      <circle cx={0} cy={0} r={30} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={2} />
      {flashHead && <circle data-flash="head" cx={0} cy={0} r={30} fill="#fff" opacity={0.55} />}
    </g>
  );
  ```

- [ ] **Step 5: Run photo tests + full suite + typecheck**

Run: `npx vitest run src/components/HybridRig.test.tsx && npx tsc --noEmit`
Expected: PASS (10/10 in the file); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/HybridRig.tsx src/components/rigHeadFraming.ts src/components/HybridRig.test.tsx
git commit -m "feat(M19-B): HybridRig photo head (base-prefixed image + focal map + onError fallback)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

> **Refinement to carry into Task 6:** change `HybridRig`'s knockdown owner to trigger on either signal — `const isDown = downed || pose === 'down';` and use `isDown` in `rootTransform`. This lets the timeline's `'down'` final pose keep the loser down during playback while `downed` handles the settled `ko-down` mode. Update the Task 4 test that passes `downed:true` — it still passes; add no new assertion.

---

### Task 6: `arenaVisualMode` state machine + `ArenaStage` pure renderer

**Files:**
- Create: `src/screens/arenaVisualMode.ts`, `src/screens/ArenaStage.tsx`
- Test: `src/screens/arenaVisualMode.test.ts`, `src/screens/ArenaStage.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type VisualMode = 'mat' | 'active-playback' | 'ko-down' | 'standing-idle';
  export function arenaVisualMode(phase: FightPhase, isPlaying: boolean, currentBeat: ResolvedBeat | null): VisualMode;
  ```
  and `<ArenaStage>` — a **pure** renderer (no `useBeatPlayback`, no timers, no state). Props:
  ```ts
  interface Identity { fighterId?: string; name: string; archetype: Archetype; cornerColor: string; }
  interface ArenaStageProps {
    mode: VisualMode;
    play: PlaybackState;
    player: Identity;
    opponent: Identity;
    hud: React.ReactNode;   // HUD band content (Task 9 fills; Task 6 passes a simple band)
    roundLabel: string;     // e.g. "ROUND 2" (Anton, gold belt row lives here)
  }
  ```
- Consumes: `PlaybackState` (hook), `HybridRig` (Task 5), `arena-idle.css` (Task 7), `tokens`.

**State-machine rules:** `phase==='ground'` → `'mat'`; else `isPlaying` → `'active-playback'`; else `currentBeat?.isFinish` → `'ko-down'`; else `'standing-idle'`.

- [ ] **Step 1: Write failing `arenaVisualMode` tests**

Create `src/screens/arenaVisualMode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { arenaVisualMode } from './arenaVisualMode';
import { buildResolvedBeat } from '../domain/combat/beat';

const strikeBeat = buildResolvedBeat({
  round: 1, exchange: 1, winner: 'player', dominance: 3,
  moveClass: 'strike', moveId: 'jab', outcome: 'landed', target: 'head',
  deltas: { playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0, opponentHead: 10, opponentBody: 0, opponentLeg: 0, opponentStamina: 1 },
  status: { playerBecameRocked: false, opponentBecameRocked: false, playerGassed: false, opponentGassed: false },
  signatureId: null, isFinish: false, finishMethod: null,
});
const finishBeat = { ...strikeBeat, isFinish: true, finishMethod: 'KO' as const };

describe('arenaVisualMode', () => {
  it('ground phase => mat', () => {
    expect(arenaVisualMode('ground', false, strikeBeat)).toBe('mat');
    expect(arenaVisualMode('ground', true, finishBeat)).toBe('mat'); // ground wins over everything
  });
  it('playing (non-ground) => active-playback', () => {
    expect(arenaVisualMode('in-round', true, strikeBeat)).toBe('active-playback');
    expect(arenaVisualMode('finish-window', true, strikeBeat)).toBe('active-playback');
  });
  it('settled finish => ko-down', () => {
    expect(arenaVisualMode('finished', false, finishBeat)).toBe('ko-down');
  });
  it('settled non-finish => standing-idle', () => {
    expect(arenaVisualMode('in-round', false, strikeBeat)).toBe('standing-idle');
    expect(arenaVisualMode('in-round', false, null)).toBe('standing-idle');
    expect(arenaVisualMode('corner', false, strikeBeat)).toBe('standing-idle');
  });
});
```

- [ ] **Step 2: Run to verify failure; then implement `arenaVisualMode.ts`**

```ts
import type { FightPhase } from '../domain/combat/fightState';
import type { ResolvedBeat } from '../domain/combat/beat';

export type VisualMode = 'mat' | 'active-playback' | 'ko-down' | 'standing-idle';

export function arenaVisualMode(
  phase: FightPhase,
  isPlaying: boolean,
  currentBeat: ResolvedBeat | null,
): VisualMode {
  if (phase === 'ground') return 'mat';
  if (isPlaying) return 'active-playback';
  if (currentBeat?.isFinish) return 'ko-down';
  return 'standing-idle';
}
```

Run: `npx vitest run src/screens/arenaVisualMode.test.ts` → PASS (4/4).

- [ ] **Step 3: Write failing `ArenaStage` tests**

Create `src/screens/ArenaStage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ArenaStage } from './ArenaStage';
import { IDLE_PLAYBACK } from '../replay/useBeatPlayback';   // export a reusable idle constant if not present

const ids = {
  player: { fighterId: undefined, name: 'You', archetype: 'striker' as const, cornerColor: '#e23b2e' },
  opponent: { fighterId: 'jon-jones', name: 'Jon Jones', archetype: 'allrounder' as const, cornerColor: '#2f6fb0' },
};

describe('ArenaStage', () => {
  it('mounts both rigs with correct facing (player right, opponent left)', () => {
    const { container } = render(
      <ArenaStage mode="standing-idle" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />,
    );
    expect(container.querySelector('[data-rig="player"]')).not.toBeNull();
    expect(container.querySelector('[data-rig="opponent"]')).not.toBeNull();
  });

  it('applies shakeX to the shake layer, not the HUD', () => {
    const play = { ...IDLE_PLAYBACK, shakeX: 6 };
    const { container } = render(
      <ArenaStage mode="active-playback" play={play} {...ids} hud={<div data-testid="hud" />} roundLabel="ROUND 1" />,
    );
    const shake = container.querySelector('[data-layer="shake"]');
    expect(shake!.getAttribute('transform')).toContain('translate(6');
  });

  it('adds the arena-idle class only in standing-idle mode', () => {
    const { container: idle } = render(
      <ArenaStage mode="standing-idle" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />);
    expect(idle.querySelector('.arena-idle')).not.toBeNull();
    const { container: playing } = render(
      <ArenaStage mode="active-playback" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />);
    expect(playing.querySelector('.arena-idle')).toBeNull();
  });

  it('keeps the losing fighter down in ko-down mode', () => {
    const play = { ...IDLE_PLAYBACK, opponentPose: 'down' as const };
    const { container } = render(
      <ArenaStage mode="ko-down" play={play} {...ids} hud={null} roundLabel="ROUND 3" />);
    expect(container.querySelector('[data-rig="opponent"]')!.getAttribute('data-pose')).toBe('down');
  });
});
```

> If `useBeatPlayback` does not already export an idle constant, add `export const IDLE_PLAYBACK: PlaybackState = IDLE_STATE;` (rename or alias the existing internal `IDLE_STATE`). This is a tiny additive export, not a behavior change.

- [ ] **Step 4: Implement `src/screens/ArenaStage.tsx`**

```tsx
import './arena-idle.css';
import { HybridRig } from '../components/HybridRig';
import type { PlaybackState } from '../replay/useBeatPlayback';
import type { VisualMode } from './arenaVisualMode';
import type { ArchetypeId } from '../domain/combat/archetypes';

interface Identity { fighterId?: string; name: string; archetype: ArchetypeId; cornerColor: string; }
interface ArenaStageProps {
  mode: VisualMode;
  play: PlaybackState;
  player: Identity;
  opponent: Identity;
  hud: React.ReactNode;
  roundLabel: string;
}

export function ArenaStage({ mode, play, player, opponent, hud, roundLabel }: ArenaStageProps) {
  const wrapClass = 'arena-stage' + (mode === 'standing-idle' ? ' arena-idle' : '');
  return (
    <div className={wrapClass} data-mode={mode}
         style={{ position: 'relative', background: 'radial-gradient(120% 80% at 50% 0%,#241d14 0%,#14110c 55%,#131313 100%)' }}>
      {/* HUD band — HTML overlay, OUTSIDE the shake layer, Octagon Elite tokens */}
      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 5, pointerEvents: 'none',
                    display: 'flex', justifyContent: 'space-between' }}>
        {hud}
      </div>
      <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', zIndex: 6,
                    fontFamily: 'Anton, sans-serif', letterSpacing: '.06em', color: '#f2ca50', fontSize: 13 }}>
        {roundLabel}
      </div>
      <svg viewBox="0 0 390 300" width="100%" role="img" aria-label="Fight arena"
           style={{ display: 'block', maxHeight: 300 }}>
        <defs>
          <radialGradient id="arena-shad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,.55)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <ellipse cx={195} cy={286} rx={180} ry={20} fill="rgba(242,202,80,.08)" />
        <g data-layer="shake" transform={`translate(${play.shakeX},0)`}>
          <g transform="translate(50,0)">
            <HybridRig side="player" facing="right"
              fighterId={player.fighterId} name={player.name} archetype={player.archetype} cornerColor={player.cornerColor}
              pose={play.playerPose}
              flashHead={play.flashHeadPlayer} flashBody={play.flashBodyPlayer} flashLeg={play.flashLegPlayer}
              downed={play.playerPose === 'down'} />
          </g>
          <g transform="translate(160,0)">
            <HybridRig side="opponent" facing="left"
              fighterId={opponent.fighterId} name={opponent.name} archetype={opponent.archetype} cornerColor={opponent.cornerColor}
              pose={play.opponentPose}
              flashHead={play.flashHeadOpponent} flashBody={play.flashBodyOpponent} flashLeg={play.flashLegOpponent}
              downed={play.opponentPose === 'down'} />
          </g>
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Run ArenaStage + full suite + typecheck**

Run: `npx vitest run src/screens/ArenaStage.test.tsx src/screens/arenaVisualMode.test.ts && npx tsc --noEmit`
Expected: PASS. (`.arena-idle` presence is asserted; the keyframe itself lands in Task 7.)

- [ ] **Step 6: Commit**

```bash
git add src/screens/arenaVisualMode.ts src/screens/arenaVisualMode.test.ts src/screens/ArenaStage.tsx src/screens/ArenaStage.test.tsx src/replay/useBeatPlayback.ts
git commit -m "feat(M19-B): arenaVisualMode state machine + ArenaStage pure renderer

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 7: Idle CSS layer (paused during playback, disabled under reduced-motion; no rAF)

**Files:**
- Create: `src/screens/arena-idle.css`
- Test: `src/screens/ArenaStage.test.tsx` (extend — class + reduced-motion behavior via markup)

**Constraint:** idle motion is **CSS keyframes only**. No `requestAnimationFrame`, no `Date.now`, no JS clock. Bob runs only when the wrapper has `arena-idle` (i.e. `mode==='standing-idle'`), and is force-disabled under `prefers-reduced-motion`.

- [ ] **Step 1: Create `src/screens/arena-idle.css`**

```css
@keyframes rigBob {
  0%   { transform: translateY(0); }
  50%  { transform: translateY(-4px); }
  100% { transform: translateY(0); }
}
.arena-idle .rig-bob {
  animation: rigBob 2s ease-in-out infinite;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .arena-idle .rig-bob { animation: none; }
}
```

- [ ] **Step 2: Add an assertion that the bob group exists and is gated by the idle class**

Add to `src/screens/ArenaStage.test.tsx`:

```tsx
it('only exposes the idle bob group under the arena-idle wrapper', () => {
  const { container } = render(
    <ArenaStage mode="standing-idle" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />);
  expect(container.querySelector('.arena-idle .rig-bob')).not.toBeNull();
});
```

- [ ] **Step 3: Run tests + full suite**

Run: `npx vitest run src/screens/ArenaStage.test.tsx && npx tsc --noEmit`
Expected: PASS. (Actual bob motion + reduced-motion pause are visual — verified in the Task 12 dev-look; jsdom does not run CSS animations.)

- [ ] **Step 4: Grep gate — no new animation clock introduced by the arena**

Run: `grep -rn "requestAnimationFrame\|Date.now\|setInterval" src/screens/ArenaStage.tsx src/screens/arena-idle.css`
Expected: EMPTY.

- [ ] **Step 5: Commit**

```bash
git add src/screens/arena-idle.css src/screens/ArenaStage.test.tsx
git commit -m "feat(M19-B): CSS idle bob layer (paused off standing-idle, disabled under reduced-motion)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 8: Wire `ArenaStage` into `FightView` + control-lock all panels while `isPlaying`

**Files:**
- Modify: `src/screens/FightView.tsx`
- Test: `src/screens/FightView.test.tsx` (extend; keep all existing cases green)

**Scope note — `App.tsx` is NOT touched.** Verified against merged main: `App.tsx` already passes `fightState={run.fight}` (which carries `beats` + `seed`) and all 7 callbacks. All new behavior lives inside `FightView`. This keeps the M19-A dormancy contract (App byte-identical to origin/main) intact through M19-B for `App.tsx`.

**Key merged facts baked in (verified @ `dd50431`):**
- `FightPhase = 'in-round' | 'corner' | 'finish-window' | 'ground' | 'finished'` (NOT `'striking'`).
- `FightState` has `seed: string` + `beats: ResolvedBeat[]` (seeded `[]` in `startFight`, appended at every resolution site incl. `finish.ts`).
- Existing `FightView.test.tsx` fixtures OMIT `beats` → read defensively as `fightState.beats?.at(-1) ?? null` so those fixtures yield `currentBeat=null` → `isPlaying=false` → panels render → **every existing test stays green unchanged.**
- `FightState.opponent.archetype` is typed `string` → cast `as ArchetypeId` at the ArenaStage boundary; HybridRig's tint map must default unknown archetypes (Task 4 guard).
- The existing two `FighterHealthCard`s (avatar-count + photo tests depend on exactly 2 `fighter-avatar` / scoped `fighter-photo`) are KEPT as the info-HUD row. `HybridRig` uses `data-rig`/`<image>` (NOT `fighter-avatar`/`fighter-photo`) → no unscoped-query collision. The arena subtree is decorative (`aria-hidden` on the rigs so `getByRole('img',{name:'Me portrait'})` stays unique to the health card).

- [ ] **Step 1: Write failing control-lock tests**

Add to `src/screens/FightView.test.tsx` (extend the existing `base()` helper usage — pass a real `beats` array for the lock cases):

```tsx
import { buildResolvedBeat } from '../domain/combat/beat';

const landedBeat = buildResolvedBeat({
  round: 1, exchange: 2, winner: 'player', dominance: 4,
  moveClass: 'strike', moveId: 'jab', outcome: 'landed', target: 'head',
  deltas: { playerHead:0, playerBody:0, playerLeg:0, playerStamina:2, opponentHead:12, opponentBody:0, opponentLeg:0, opponentStamina:1 },
  status: { playerBecameRocked:false, opponentBecameRocked:false, playerGassed:false, opponentGassed:false },
  signatureId: null, isFinish:false, finishMethod:null,
});

it('locks all panels while a beat is playing (2nd decision impossible mid-playback)', () => {
  const onMove = vi.fn();
  // matchMedia defaults to not-reduced-motion (setup.ts) → animation path → isPlaying true at t=0
  const st = base({ beats: [landedBeat] });
  render(<FightView fightState={st} playerName="Me" onMove={onMove} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
  expect(screen.queryByTestId('strike-panel')).toBeNull();          // locked
  expect(screen.getByTestId('fight-view')).toHaveAttribute('data-round', '1'); // arena still mounted
});

it('unlocks immediately under prefers-reduced-motion', () => {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...mql, matches: true } as MediaQueryList);
  const st = base({ beats: [landedBeat] });
  render(<FightView fightState={st} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
  expect(screen.getByTestId('strike-panel')).toBeInTheDocument(); // reduced-motion → not playing → shown
  spy.mockRestore();
});
```

- [ ] **Step 2: Run to verify RED, then implement the wiring in `FightView.tsx`**

Add imports:
```tsx
import { useBeatPlayback } from '../replay/useBeatPlayback';
import { ArenaStage } from './ArenaStage';
import { arenaVisualMode } from './arenaVisualMode';
import type { ArchetypeId } from '../domain/combat/archetypes';
```

Inside the component, after `const sigReady = ...`:
```tsx
const currentBeat = fightState.beats?.at(-1) ?? null;
const play = useBeatPlayback(currentBeat, fightState.seed);
const mode = arenaVisualMode(phase, play.isPlaying, currentBeat);

const playerIdentity = {
  fighterId: undefined,
  name: playerName,
  archetype: archetypeFromStatLine(player.statLine),
  cornerColor: '#e23b2e', // red corner (approved glove color)
};
const opponentIdentity = {
  fighterId: fighterIdByName(opponent.name),
  name: opponent.name,
  archetype: opponent.archetype as ArchetypeId,
  cornerColor: '#2f6fb0', // blue corner
};
```

Markup changes:
1. **Remove** the standalone `<p ...>{roundLabel(fightState)}</p>` (its label moves into the arena HUD; no test asserts its text — verified).
2. **Insert** the arena immediately after the two-`FighterHealthCard` `<div>`:
```tsx
<ArenaStage
  mode={mode}
  play={play}
  player={playerIdentity}
  opponent={opponentIdentity}
  roundLabel={roundLabel(fightState)}
  hud={null}
/>
```
3. **Wrap** the entire phase-panel block (`in-round`/`corner`/`finish-window`/`ground`/`finished`) in a single `{!play.isPlaying && ( … )}` fragment.

Keep the `<section>` `data-round`/`data-exchange`/`data-phase`/`data-player-head` attributes bound to the REAL `fightState` (unchanged — resume/e2e determinism depends on them).

- [ ] **Step 3: Run FightView suite + full suite + typecheck**

Run: `npx vitest run src/screens/FightView.test.tsx && npx vitest run && npx tsc --noEmit`
Expected: all existing FightView cases + the 2 new lock cases PASS; full suite green.

- [ ] **Step 4: Commit**

```bash
git add src/screens/FightView.tsx src/screens/FightView.test.tsx
git commit -m "feat(M19-B): mount ArenaStage in FightView + control-lock panels during playback

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 9: HUD timing — hold displayed bars until impact/completion

**Problem (verified):** `FighterHealthCard` reads `healthPct(player)`/`bodyPct`/`staminaPct` straight off `fightState`, which is already the POST-beat state the instant `resolveExchange` runs — so the bar drops **before** the punch visibly lands. Fix: hold the DISPLAYED fight values at the pre-beat snapshot until the beat reaches impact (first flash) or playback completes.

**Files:**
- Create: `src/screens/useCommittedFight.ts`, `src/screens/useCommittedFight.test.ts`
- Modify: `src/screens/FightView.tsx` (read health cards from the held snapshot)
- Test: `src/screens/FightView.test.tsx` (held-before-impact case)

- [ ] **Step 1: Write failing `useCommittedFight` tests**

```ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCommittedFight } from './useCommittedFight';

const fs = (headDamage: number) => ({ player: { headDamage } }) as any;

describe('useCommittedFight', () => {
  it('commits immediately when committed=true', () => {
    const { result, rerender } = renderHook(({ s, c }) => useCommittedFight(s, c), {
      initialProps: { s: fs(0), c: true },
    });
    expect(result.current.player.headDamage).toBe(0);
    rerender({ s: fs(30), c: true });
    expect(result.current.player.headDamage).toBe(30);
  });
  it('holds the previous snapshot while committed=false', () => {
    const { result, rerender } = renderHook(({ s, c }) => useCommittedFight(s, c), {
      initialProps: { s: fs(0), c: true },
    });
    rerender({ s: fs(30), c: false });  // new state, not yet committed
    expect(result.current.player.headDamage).toBe(0); // held
    rerender({ s: fs(30), c: true });   // impact/completion
    expect(result.current.player.headDamage).toBe(30);
  });
});
```

- [ ] **Step 2: Implement `useCommittedFight.ts`**

```ts
import { useRef } from 'react';
import type { FightState } from '../domain/combat';

/** Returns the fight snapshot to DISPLAY: live state once `committed`, otherwise the last committed snapshot (held during pre-impact playback). */
export function useCommittedFight(fightState: FightState, committed: boolean): FightState {
  const held = useRef(fightState);
  if (committed) held.current = fightState;
  return held.current;
}
```

- [ ] **Step 3: Wire the held snapshot into `FightView` + failing FightView test**

In `FightView.tsx`, derive the commit signal and read the health cards from the held snapshot:
```tsx
const anyFlash =
  play.flashHeadPlayer || play.flashBodyPlayer || (play.flashLegPlayer ?? false) ||
  play.flashHeadOpponent || play.flashBodyOpponent || (play.flashLegOpponent ?? false);

// impact latch: once a flash fires during THIS beat, HP is committed for the remainder
const beatRef = useRef<ResolvedBeat | null>(null);
const impactSeen = useRef(false);
if (beatRef.current !== currentBeat) { beatRef.current = currentBeat; impactSeen.current = false; }
if (anyFlash) impactSeen.current = true;

const committed = !play.isPlaying || impactSeen.current;
const shown = useCommittedFight(fightState, committed);
```
Point the two `FighterHealthCard`s at `shown.player` / `shown.opponent` for `healthPct`/`bodyPct`/`staminaPct`/`headStateLabel`/`damageFlash` (name/badge/archetype/avatarSeed/fighterId stay as-is). The `<section>` `data-*` attributes keep reading the REAL `fightState`.

Add the FightView test:
```tsx
it('holds displayed HP until the punch lands (no early bar drop)', () => {
  const onMove = vi.fn();
  const pre = base();                                  // opponent full HP, settled
  const { rerender } = render(<FightView fightState={pre} playerName="Me" onMove={onMove} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
  const post = base({ beats: [landedBeat], opponent: { ...pre.opponent, headDamage: 40 } });
  rerender(<FightView fightState={post} playerName="Me" onMove={onMove} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
  // isPlaying true, t=0 (no flash yet) → opponent HP bar still shows the PRE value (held)
  // FighterHealthCard renders 3 role="meter" (head @124 / body @143 / stamina @155); [0] = head/health
  const oppHealthMeter = within(screen.getByTestId('fighter-card-opponent')).getAllByRole('meter')[0];
  expect(oppHealthMeter.getAttribute('aria-valuenow')).toBe(String(Math.round(healthPct(pre.opponent) * 100)));
});
```
> Verified vs merged main: each meter exposes `aria-valuenow={Math.round(clamped*100)}` + `aria-valuemax={100}`; the health meter is the first of the three. Intent: held == pre value while playing pre-impact.

- [ ] **Step 4: Run + commit**

Run: `npx vitest run src/screens/useCommittedFight.test.ts src/screens/FightView.test.tsx && npx tsc --noEmit`
```bash
git add src/screens/useCommittedFight.ts src/screens/useCommittedFight.test.ts src/screens/FightView.tsx src/screens/FightView.test.tsx
git commit -m "feat(M19-B): hold HUD bars until impact (kill pre-landing HP drop)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 10: Visual-mode pose resolution — settle-idle, KO-stays-down, mat overlay

**Files:**
- Modify: `src/screens/ArenaStage.tsx`
- Test: `src/screens/ArenaStage.test.tsx` (extend)

**Rules (visual-mode → display pose):**
- `active-playback` → raw `play` poses (the animation).
- `standing-idle` → force BOTH rigs to `'idle'` (ignore the timeline's DIAGNOSTIC final pose, which can leave the target frozen in `hurt`/`reel`).
- `ko-down` → raw `play` poses (the loser's final pose is already `'down'` from the finish beat; the winner stays in their final stance). Loser stays down.
- `mat` → dim the stage + show an Octagon-Elite `ON THE MAT` label overlay; rigs render underneath (pose irrelevant).

- [ ] **Step 1: Write failing tests**

```tsx
it('forces idle stance when settled (standing-idle), ignoring the diagnostic hurt final pose', () => {
  const play = { ...IDLE_PLAYBACK, opponentPose: 'hurt' as const, playerPose: 'hurt' as const };
  const { container } = render(<ArenaStage mode="standing-idle" play={play} {...ids} hud={null} roundLabel="ROUND 1" />);
  expect(container.querySelector('[data-rig="opponent"]')!.getAttribute('data-pose')).toBe('idle');
  expect(container.querySelector('[data-rig="player"]')!.getAttribute('data-pose')).toBe('idle');
});

it('keeps the loser down in ko-down (raw down pose preserved)', () => {
  const play = { ...IDLE_PLAYBACK, opponentPose: 'down' as const };
  const { container } = render(<ArenaStage mode="ko-down" play={play} {...ids} hud={null} roundLabel="ROUND 3" />);
  expect(container.querySelector('[data-rig="opponent"]')!.getAttribute('data-pose')).toBe('down');
});

it('shows the on-the-mat overlay in mat mode', () => {
  const { getByText } = render(<ArenaStage mode="mat" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 2" />);
  expect(getByText(/on the mat/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the pose resolver + mat overlay in `ArenaStage.tsx`**

```tsx
const resolvePose = (raw: PoseName): PoseName => (mode === 'standing-idle' ? 'idle' : raw);
const pPose = resolvePose(play.playerPose);
const oPose = resolvePose(play.opponentPose);
```
Pass `pose={pPose} downed={pPose === 'down'}` (player) and `pose={oPose} downed={oPose === 'down'}` (opponent). Add, inside the arena container (outside the shake layer, zIndex above the svg), when `mode === 'mat'`:
```tsx
{mode === 'mat' && (
  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                background:'rgba(19,19,19,.55)', zIndex:7,
                fontFamily:'Space Mono, monospace', letterSpacing:'.15em', color:'#d0c5af', fontSize:13 }}>
    ON THE MAT
  </div>
)}
```
(Import `PoseName` from `../replay/poses`.)

- [ ] **Step 3: Run + full suite + commit**

Run: `npx vitest run src/screens/ArenaStage.test.tsx && npx vitest run && npx tsc --noEmit`
```bash
git add src/screens/ArenaStage.tsx src/screens/ArenaStage.test.tsx
git commit -m "feat(M19-B): visual-mode pose resolution (settle-idle, KO-stays-down, mat overlay)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 11: Responsive budget + HUD info parity + Octagon Elite chrome discipline

**Goal:** the arena must not regress fight information, must obey Octagon Elite tokens for chrome, and decisions must remain reachable at **360×640 AND 390×844**.

**Files:**
- Modify: `src/screens/ArenaStage.tsx` (route chrome colors/type through tokens; fixed stage-height budget), `src/screens/FightView.tsx` (layout budget)
- Test: `src/screens/ArenaStage.test.tsx` / `FightView.test.tsx` (parity assertions)

- [ ] **Step 1: Chrome token discipline (fidelity bar).** Convert the arena's HUD/chrome (round label, mat label, any band text) from inline hex to the Octagon Elite tokens — use the Tailwind token utilities already in the app (`font-display` = Anton, `font-mono` = Space Mono, `text-primary` = gold `#f2ca50`, `text-on-surface-variant`, `bg-surface`) OR import from `src/theme/tokens.ts`. The ONLY intentional non-token palette is the **fighter layer** (rig body archetype tints + corner-color gloves `#e23b2e`/`#2f6fb0`) — document that exception inline. No default/system fonts, 0px radius on any arena chrome.

- [ ] **Step 2: HUD info parity assertions.** The two `FighterHealthCard`s already render head-state (rocked/gassed) + body condition + stamina; assert they survive the arena insertion. Verified exact signals vs merged main: the card root carries `data-testid={`fighter-card-${side}`}` + `data-head-state={headStateLabel}`, and renders 3 `role="meter"` (head/body/stamina). `headState` is imported from `../fightDisplay` (returns `'fresh'|'hurt'|'rocked'`).
```tsx
it('preserves HUD info parity (head-state + body/stamina meters retained)', () => {
  const st = base({ player: { ...base().player, headDamage: 40, stamina: 20 } });
  render(<FightView fightState={st} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
  const card = screen.getByTestId('fighter-card-player');
  expect(card).toHaveAttribute('data-head-state', headState(st.player)); // rocked/hurt/fresh preserved
  expect(within(card).getAllByRole('meter').length).toBe(3);             // head + body + stamina all present
});
```

- [ ] **Step 3: Fixed stage-height budget.** Give `ArenaStage` a fixed responsive height cap (`maxHeight` ~40vh, ≤300px) so the health-card row + arena + active panel all fit without the decision panel being pushed off-screen. Verify in the Task 12 dev-look at both viewport sizes (jsdom does no layout — this is a manual/dev check, documented).

- [ ] **Step 4: Run + commit**

```bash
git add src/screens/ArenaStage.tsx src/screens/FightView.tsx src/screens/ArenaStage.test.tsx src/screens/FightView.test.tsx
git commit -m "feat(M19-B): Octagon Elite chrome tokens + HUD info parity + responsive stage budget

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

### Task 12: Feel-gate v2 harness + full gate + open PR (DO NOT MERGE)

**Files:**
- Create: `src/screens/ArenaDemo.tsx` (dev-only capture harness), `docs/superpowers/feel-gate-v2.md`
- Modify: `src/App.tsx` — **only** a dev-gated `?arena=demo` route (see constraint below)

**⚠️ App.tsx dormancy note:** M19-A kept `App.tsx` byte-identical to origin/main. M19-B's user-visible release DOES legitimately touch `App.tsx` — but ONLY to add a dev/QA capture route guarded by a query param, mirroring the (now-pruned) `?lab=1` pattern. This route mounts the REAL `FightView` with a fixed-seed scripted fight for blind feel-gate captures; it is NOT part of the normal run flow (which reaches `FightView` through the existing `phase==='fighting'` branch, already wired). Keep the diff minimal (a few lines).

- [ ] **Step 1: `ArenaDemo.tsx` — fixed-seed scripted fight at NORMAL speed.** Drive a deterministic sequence through the real engine (`startFight` → scripted `resolveExchange` moves incl. a jab, a power punch, a **leg kick**, a body kick, and a scripted KO finish) and render the REAL `FightView` so captures reflect production. Include: the McGregor hero fighter (photo head), a differently-framed roster opponent, and a **custom-player** (procedural-head) variant selectable by query (`?arena=demo&who=custom`). No `Math.random`/`Date.now` — fixed seed only.

- [ ] **Step 2: `feel-gate-v2.md` — blind protocol (drop the retired M18 signature gate).** Solo blind classification on the REAL FightView at normal speed. Reviewer must, per clip: ID the actor; call punch vs kick; call hit/miss/block; name the target zone (head/body/legs); recognize a knockdown. Coverage: mobile (390px) + ≥3 differently-framed photos + the custom-player fallback + a leg-kick clip. Ship criterion: all classifications correct + impact ≥4/5 + "would I use this as store-page proof?" = yes. Evidence (screenshots/answers) committed to the PR.

- [ ] **Step 3: FULL GATE (all must pass; capture outputs in the PR body):**
  1. `npx vitest run` ×2 → byte-identical, 0 failures.
  2. `npx tsc --noEmit` → exit 0.
  3. `npm run build` → success.
  4. **RNG-parity:** the M18 `headDamage===36` anchor test green (M19-B adds ZERO new `rng()` draws — timeline/pose/tint/photo are presentation-only; verify no new `rng(`/`createRng(` in `src/domain`).
  5. **Balance bands** unchanged (all 7 pass at PLAN strength — M19-B does not touch engine knobs).
  6. **One-way import:** `grep -rn "from '.*replay\|from '.*screens\|from '.*components" src/domain` → EMPTY (domain must not import presentation).
  7. **No new clock/entropy:** `grep -rn "Math.random\|Date.now\|setInterval\|setTimeout" src/replay src/screens/ArenaStage.tsx src/screens/arena-idle.css src/components/HybridRig.tsx` → EMPTY (idle is CSS; playback is the merged rAF hook only).
  8. **Deps byte-identical:** `git diff --stat origin/main -- package.json package-lock.json` → EMPTY.
  9. **tokens.test** green; arena chrome uses tokens (fighter-layer palette is the documented exception).
  10. Every commit carries BOTH trailers; `HEAD == @{u} == PR head`.

- [ ] **Step 4: Dev-look (make-or-break).** `npm run dev`, open `?arena=demo` at 390×844 and 360×640: idle-bob reads alive but calm; a jab vs a leg kick are DISTINGUISHABLE; contact has flash + shake + hitstop; a KO drops the loser and they STAY down; panels are locked during motion and reachable when settled; photo heads sit correctly on the bodies (spot-check 3 framings + the custom procedural head). Capture the feel-gate clips here.

- [ ] **Step 5: Open ONE PR → DO NOT MERGE.**
```bash
git push -u origin <branch>
gh pr create --base main --title "M19-B: Live Hybrid Arena" --body "<gate outputs + feel-gate evidence + DO NOT MERGE>"
```
Report: PR#, HEAD SHA, CI on exact SHA, per-commit trailer audit, RED-first evidence (Tasks 2/3-style), the full-gate outputs, and the feel-gate captures. **Do NOT merge, do NOT deploy** — the orchestrator re-verifies, runs gpt-5.6-sol xhigh + Copilot review, and surfaces the feel-gate to the user (the human-only ship criterion for the first user-visible arena release).

---

## Self-review (writing-plans checklist)

**Spec-coverage map (design doc §→task):**
- Style-C hybrid rig (photo head on tinted vector body, facing-aware) → Tasks 4–5.
- Layout-B live arena (both fighters on screen whole round, idle-bob, react to decisions; panels beneath) → Tasks 6, 8, 10.
- Shared motion set (one punch/one kick anim + slip/block/hurt/knockdown), Tweened WAAPI → Tasks 1, 4 (+ Task 2 pose emission).
- Ground deferred to "on the mat" state → Task 10 (mat overlay) + Task 8 (`arenaVisualMode` `ground→mat`).
- Exhaustive move-family mapping (fix `jab/cross/hook→'cross'` bug) → Task 2 (`moveFamily` + `timeline` rewrite).
- Articulated legs + new poses (punch/kick load/contact, hit-leg) → Task 1 (`rigPoses`) + Task 2 (leg flash/reaction) + Task 3 (`flashLeg*`).
- Double-rotation fix (single knockdown transform owner) → Task 4 (`isDown` root-rotate, `RIG_POSES.down.torso` shallow).
- Control-lock all panels while `isPlaying` (reduced-motion unlocks) → Task 8.
- HUD hold-until-impact → Task 9.
- Settle-idle (non-finish → idle/guard, ignore diagnostic final pose) + KO-stays-down → Task 10.
- Visual-mode state machine (mat/active-playback/ko-down/standing-idle) → Task 6 (`arenaVisualMode`) + Task 10 (pose resolution).
- CSS idle layer (paused during playback, disabled under reduced-motion, no rAF/clock) → Task 7.
- SVG determinism traps (semantic clip ids, memoized rigs, HUD outside shake, base-prefixed photo href + onError fallback, focal map, procedural head fragment) → Tasks 4–6.
- Custom-player procedural head (product-correct) → Task 4/5 (no `fighterId` → fallback) + feel-gate coverage (Task 12).
- HUD info parity + responsive budget (360×640 + 390×844) → Task 11.
- Octagon Elite fidelity (tokens for chrome; fighter layer = documented exception; arena is an uncovered screen) → Task 11 + Task 12 gate #9.
- Feel-gate v2 on the REAL FightView at normal speed (drop retired M18 signature gate) → Task 12.
- 10 deterministic RED→GREEN priorities → Tasks 2 (frame-trace via Task 3 char-snapshot regen), 8 (2nd-decision-blocked), 7 (idle class only when settled), 8/10 (ground overrides standing), 2 (exhaustive StrikeId map), 2 (legKick→leg reaction), 10 (non-finish settles idle / KO stays down), 5 (photo href base-prefixed + fallback), 5 (left-facing photo counter-mirrored), 4/6 (both rig nodes survive rerenders via memo).

**No placeholders:** every task has full interfaces + complete code (rig geometry/poses transcribed verbatim from the approved prototype; hook/timeline/FightView facts verified against merged main `dd50431`).

**Testids / signatures consistency:** rig root `data-rig="player|opponent"` + `data-pose`; arena `[data-layer="shake"]`, `.arena-idle .rig-bob`, `data-mode`; NO reuse of `fighter-avatar`/`fighter-photo` (health-card tests protected); `useBeatPlayback(beat, seed)` + `PlaybackState` consumed as merged (Task 3 adds `flashLeg*` + `IDLE_PLAYBACK` export additively); `arenaVisualMode(phase, isPlaying, currentBeat)`; `useCommittedFight(fightState, committed)`.

**Shapes verified vs merged main (not assumed):** `FightPhase` values (`in-round` not `striking`); `FightState.seed`+`beats` (seeded `[]`, appended at all sites incl. `finish.ts:201`); `FightView` 7-prop signature + existing markup/testids; `opponent.archetype: string` (cast `as ArchetypeId`, tint default); `ArchetypeId` 5-value union; `App.tsx` already feeds `run.fight` → **App untouched except the dev-only `?arena=demo` route in Task 12**; existing `FightView.test.tsx` fixtures omit `beats` → defensive `?.at(-1)` keeps them green; merged `PlaybackState` lacks `flashLeg*`/`IDLE_PLAYBACK` → Task 3 adds them additively.

**Open risks (carried):** (1) live fight-FEEL is the ultimate gate — Task 12 feel-gate v2 on the REAL FightView is the human-only ship criterion (standing #1 residual risk of the whole epic). (2) Photo crop quality across all 38 fighters unproven — `rigHeadFraming` starts at default + empty overrides, tuned during the feel-gate. (3) Tweened WAAPI is browser-only (jsdom guards to instant) → motion quality is a dev-look/feel-gate check, not unit-testable.
