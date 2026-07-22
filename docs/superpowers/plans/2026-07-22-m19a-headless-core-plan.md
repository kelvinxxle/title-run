# M19-A — Dormant Fight-Presentation Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the VERIFIED M18 fight-presentation engine (beat contract, timeline, poses, playback driver, VFX) on `main` as tested-but-**dormant** modules — no live FightView mount, no public `?lab` route — and extract the verified rAF/hitstop loop into a reusable `useBeatPlayback` hook, proven behavior-identical by a characterization test.

**Architecture:** This is the first of two M19 PRs (disposition: *split the verified core, merge dormant, build arena on top*). It ships the engine dormant so the rejected stick-figure renderer never reaches users, while landing the hard-won, fully-tested beat/timeline/hitstop machinery on `main` for the Live Hybrid Arena (M19-B) to build on. No new behavior: a mechanical port + prune of PR #23, plus one verbatim hook extraction guarded by a frame-trace characterization test.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind + Vitest + React Testing Library. Client-only, seeded RNG, localStorage. GitHub Pages base path `/title-run/`.

## Global Constraints

- **No `Math.random` / `Date.now` in production code** (test-only mocks OK). Playback timing uses `requestAnimationFrame` deltas, never `Date.now`.
- **No new runtime dependencies.** `package.json` / `package-lock.json` must be byte-identical to `origin/main` at PR open.
- **Strict TDD:** every code change starts with a failing test (RED), then minimal code (GREEN). Commit per task.
- **Determinism preserved:** M18 added ZERO new `rng()` draws. The RNG-parity anchor (`opponent.headDamage === 36` snapshot) and the 10 balance-band tests must stay green and byte-identical across two consecutive `npx vitest run` invocations.
- **Commit trailers on EVERY commit:**
  ```
  Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
  Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d
  ```
- **Base branch:** cut from current `origin/main` (`cd8625c` at plan time — re-fetch to confirm HEAD). **Do NOT branch off PR #23** for history cleanliness, but DO port PR #23's verified file contents (HEAD `4dab42f`) as described in Task 1.
- **Dormancy invariant:** after this PR, `src/screens/FightView.tsx` and `src/App.tsx` are **byte-identical to `origin/main`** (the renderer is not mounted, the lab route does not exist).

---

## File Structure

**Ported verbatim from PR #23 HEAD `4dab42f` (verified, unchanged):**
- `src/domain/combat/beat.ts` (+ `beat.test.ts`) — `ResolvedBeat` contract + `buildResolvedBeat`.
- `src/domain/combat/exchange.ts`, `finish.ts`, `fightState.ts`, `index.ts` — beat-emitting engine changes (RNG-neutral; beats populate `fightState.beats`).
- `src/replay/timeline.ts` (+ `timeline.test.ts`) — `buildBeatTimeline`, `computeFinalPose`, `BeatEvent`.
- `src/replay/poses.ts` — `PoseName`, `Pose`, `POSES`.
- `src/replay/simulateFight.ts` (+ `simulateFight.test.ts`), `finishKo.test.ts`.
- `src/components/FighterRig.tsx` (+ `FighterRig.test.tsx`), `fighterPalette.ts` (+ `fighterPalette.test.ts`) — the (soon-to-be-replaced) rig + palette; kept so `FightReplay` + its tests stay green and reusable.
- `src/components/FighterAvatar.tsx` — M18 modification.
- `src/persistence/runStorageV2.ts` (+ `runStorageV2.test.ts`) — `hydrateBeats` reset-to-`[]`.
- `src/test/setup.ts` — `matchMedia` mock (`configurable: true`).
- `src/replay/feel-gate.md` — reference doc (harmless).

**Created new (this plan):**
- `src/replay/useBeatPlayback.ts` — the extracted playback hook.
- `src/replay/useBeatPlayback.test.ts` — characterization frame-trace test.
- `docs/superpowers/plans/2026-07-22-m19a-headless-core-plan.md` — this plan (committed in Task 1).

**Deliberately EXCLUDED (the dormancy prune — keep these at `origin/main` state):**
- `src/screens/FightView.tsx` + `FightView.test.tsx` — do NOT bring M18's `<FightReplay>` mount.
- `src/App.tsx` + `App.test.tsx` — do NOT bring M18's `?lab=1` route.
- `src/screens/ReplayLab.tsx` — do NOT create it.

**Refactored:**
- `src/replay/FightReplay.tsx` — becomes a thin adapter over `useBeatPlayback` (keeps `FightReplay.test.tsx` green; the component stays unmounted in the app but tested and ready for M19-B reuse).

---

## Task 1: Land the dormant verified core (port + prune)

**Files:**
- Create (port from PR #23 `4dab42f`): all files under "Ported verbatim" above.
- Keep at `origin/main` state: `src/screens/FightView.tsx`, `src/screens/FightView.test.tsx`, `src/App.tsx`, `src/App.test.tsx`.
- Create: `docs/superpowers/plans/2026-07-22-m19a-headless-core-plan.md` (this file).
- Test: the full existing ported suite + a new dormancy guard `src/replay/dormancy.test.ts`.

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `ResolvedBeat`, `buildBeatTimeline(beat, seed) → { totalMs, events }`, `computeFinalPose(events, actor) → PoseName`, `POSES`, and `fightState.beats: ResolvedBeat[]` — all available on `main` but unmounted.

- [ ] **Step 1: Establish the branch and port the verified files**

```bash
git fetch origin main
git switch -c kelvinxxle-m19a-headless-core origin/main
# Port the verified M18 core from PR #23 HEAD (contents only, not history):
git checkout 4dab42f -- \
  src/domain/combat/beat.ts src/domain/combat/beat.test.ts \
  src/domain/combat/exchange.ts src/domain/combat/exchange.test.ts \
  src/domain/combat/finish.ts src/domain/combat/finish.test.ts \
  src/domain/combat/fightState.ts src/domain/combat/index.ts \
  src/replay/timeline.ts src/replay/timeline.test.ts \
  src/replay/poses.ts \
  src/replay/simulateFight.ts src/replay/simulateFight.test.ts \
  src/replay/finishKo.test.ts src/replay/feel-gate.md \
  src/replay/FightReplay.tsx src/replay/FightReplay.test.tsx \
  src/components/FighterRig.tsx src/components/FighterRig.test.tsx \
  src/components/fighterPalette.ts src/components/fighterPalette.test.ts \
  src/components/FighterAvatar.tsx \
  src/persistence/runStorageV2.ts src/persistence/runStorageV2.test.ts \
  src/test/setup.ts
```

Do NOT check out `FightView.tsx`, `FightView.test.tsx`, `App.tsx`, `App.test.tsx`, or `ReplayLab.tsx`. Confirm they are untouched:

```bash
git diff --stat origin/main -- src/screens/FightView.tsx src/App.tsx
```
Expected: empty (no changes).

- [ ] **Step 2: Write the dormancy guard test (RED)**

Create `src/replay/dormancy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// M19-A ships the fight-presentation engine DORMANT: the rejected renderer must
// not be mounted in the live fight screen, and the dev replay lab must not exist
// as a routable screen. These guards fail loudly if a future edit re-mounts it.

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');

describe('M19-A dormancy', () => {
  it('FightView does not import or mount FightReplay', () => {
    const src = read('../screens/FightView.tsx');
    expect(src).not.toMatch(/FightReplay/);
  });

  it('App does not reference a ReplayLab route', () => {
    const src = read('../App.tsx');
    expect(src).not.toMatch(/ReplayLab|lab.*===.*'1'/);
  });
});
```

Run: `npx vitest run src/replay/dormancy.test.ts`
Expected: PASS immediately (FightView/App are at origin/main state). If it FAILS, an excluded file was ported by mistake — revert it to `origin/main` and re-run. (This guard is a regression tripwire, not a red-green pair.)

- [ ] **Step 3: Full suite — establish the dormant-core green baseline**

Run: `npx vitest run`
Expected: PASS. Note the total count (M18's 529 minus the reverted FightView/App lab assertions; the exact number is whatever this ported set yields — record it). If any `FightReplay`/`FightView`/`App` test references the lab route or the FightView mount and now fails, it belongs to an excluded file — confirm that test file was NOT ported and remove any stray references.

- [ ] **Step 4: Determinism + build gates**

```bash
npx vitest run          # run #1 — record pass count
npx vitest run          # run #2 — must be byte-identical
npx tsc --noEmit        # expect: 0 errors
npm run build           # expect: success
grep -rn "Math.random\|Date.now" src --include=*.ts --include=*.tsx | grep -v test | grep -v ".test."
```
Expected: two identical vitest runs; tsc clean; build ok; the grep shows only the pre-existing `App.tsx` / `DraftScreen.tsx` occurrences (NOT in any ported replay file — `FightReplay.tsx:55` is a comment, not a call).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(M19-A): land verified M18 fight-presentation core (dormant)

Port beat/timeline/poses/FightReplay/simulateFight + beat-emitting engine
changes from PR #23 (4dab42f), verified verbatim. FightView + App left at
origin/main: renderer unmounted, no public lab route. Adds dormancy guard.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

## Task 2: Characterization test for the playback frame-trace

**Files:**
- Create: `src/replay/useBeatPlayback.test.ts`

**Interfaces:**
- Consumes: `buildBeatTimeline`, `computeFinalPose` from `./timeline`; `ResolvedBeat` from `../domain/combat/beat`.
- Produces: a frame-by-frame snapshot of the CURRENT `FightReplay` render state for a fixed `(beat, seed)`, captured BEFORE extraction. This trace is the safety net proving Task 3's extraction is behavior-identical.

**Why first:** The extraction in Task 3 must be verbatim. Capturing the exact per-frame `data-playing` / `data-final-pose-*` / flash / shake trace of the current component lets us assert the hook reproduces it exactly.

- [ ] **Step 1: Write the characterization test (drives the CURRENT FightReplay)**

Create `src/replay/useBeatPlayback.test.ts`. Use the established rAF-mock + `act` pump pattern from `FightReplay.test.tsx`. Capture a trace across a fixed frame schedule for `sigKoBeat` + seed `'char-seed'`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import FightReplay from './FightReplay';
import type { ResolvedBeat } from '../domain/combat/beat';

const sigKoBeat: ResolvedBeat = {
  id: '2-3', round: 2, exchange: 3,
  actorId: 'player', targetId: 'opponent',
  moveClass: 'signature', moveId: null, outcome: 'countered', target: 'head',
  deltas: { playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
    opponentHead: 60, opponentBody: 0, opponentLeg: 0, opponentStamina: -10 },
  status: { playerBecameRocked: false, opponentBecameRocked: true, playerGassed: false, opponentGassed: false },
  signatureId: 'the-left-hand', isFinish: true, finishMethod: 'KO',
};

const props = {
  playerId: 'p1', playerName: 'P', playerArchetype: 'striker',
  opponentId: 'o1', opponentName: 'O', opponentArchetype: 'brawler',
  presentationSeed: 'char-seed',
};

function setup() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: (q: string) => ({ matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
  });
  const cbs = new Map<number, FrameRequestCallback>();
  let id = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const i = id++; cbs.set(i, cb); return i; });
  vi.stubGlobal('cancelAnimationFrame', (i: number) => { cbs.delete(i); });
  return cbs;
}

function pump(cbs: Map<number, FrameRequestCallback>, ts: number) {
  const list = [...cbs.values()];
  cbs.clear();
  list.forEach(cb => cb(ts));
}

function snap() {
  const el = screen.getByTestId('fight-replay');
  return {
    playing: el.getAttribute('data-playing'),
    finalP: el.getAttribute('data-final-pose-player'),
    finalO: el.getAttribute('data-final-pose-opponent'),
    playerPose: screen.getAllByTestId('fighter-rig')[0].getAttribute('data-pose'),
    opponentPose: screen.getAllByTestId('fighter-rig')[1].getAttribute('data-pose'),
  };
}

describe('playback characterization (pre-extraction baseline)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('produces a stable frame trace for a fixed beat+seed', async () => {
    const cbs = setup();
    render(<FightReplay {...props} beat={sigKoBeat} />);
    const trace: unknown[] = [];
    await act(async () => { pump(cbs, 0); });      trace.push(snap());
    await act(async () => { pump(cbs, 200); });    trace.push(snap());
    await act(async () => { pump(cbs, 480); });    trace.push(snap());
    await act(async () => { pump(cbs, 900); });    trace.push(snap());
    await act(async () => { pump(cbs, 2000); });   trace.push(snap());

    // Snapshot the whole trace. This locks CURRENT behavior; Task 3 must not change it.
    expect(trace).toMatchInlineSnapshot();
  });
});
```

- [ ] **Step 2: Run to generate the inline snapshot (GREEN)**

Run: `npx vitest run src/replay/useBeatPlayback.test.ts -u`
Expected: PASS, and `toMatchInlineSnapshot()` is now populated with the concrete trace. Open the file and confirm the snapshot shows a sane progression (early frames `playing: 'true'`, final frame `playing: 'false'`, `finalO: 'down'` for the KO). Commit the populated snapshot.

- [ ] **Step 3: Commit**

```bash
git add src/replay/useBeatPlayback.test.ts
git commit -m "test(M19-A): characterization frame-trace for playback (pre-extraction)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

## Task 3: Extract `useBeatPlayback` (verbatim) + thin `FightReplay` adapter

**Files:**
- Create: `src/replay/useBeatPlayback.ts`
- Modify: `src/replay/FightReplay.tsx` (becomes a thin adapter)
- Test: `src/replay/useBeatPlayback.test.ts` (extend), `src/replay/FightReplay.test.tsx` (must stay green untouched)

**Interfaces:**
- Consumes: `buildBeatTimeline`, `computeFinalPose`, `BeatEvent` from `./timeline`; `ResolvedBeat` from `../domain/combat/beat`; `PoseName` from `./poses`.
- Produces:
  ```typescript
  export interface PlaybackState {
    playerPose: PoseName;
    opponentPose: PoseName;
    flashHeadPlayer: boolean;
    flashBodyPlayer: boolean;
    flashHeadOpponent: boolean;
    flashBodyOpponent: boolean;
    shakeX: number;
    isPlaying: boolean;
    finalPosePlayer: PoseName;
    finalPoseOpponent: PoseName;
  }
  export function useBeatPlayback(beat: ResolvedBeat | null, presentationSeed: string): PlaybackState;
  ```
  M19-B's `ArenaStage`/`FightView` consume `useBeatPlayback` directly (esp. `isPlaying` for control-locking).

- [ ] **Step 1: Create the hook by MOVING the logic verbatim**

Create `src/replay/useBeatPlayback.ts`. Move — do not rewrite — the `AnimState` shape (rename to `PlaybackState`), `IDLE_STATE`, the pure helpers (`currentPose`, `flashActive`, `shakeOffset`, `snapshotState`), the four refs, and the entire `useEffect` (matchMedia branch + rAF frame loop with the segmented hitstop handling) out of `FightReplay.tsx` into this hook. Return `animState`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { buildBeatTimeline, computeFinalPose } from './timeline';
import type { BeatEvent } from './timeline';
import type { ResolvedBeat, BeatActor } from '../domain/combat/beat';
import type { PoseName } from './poses';

export interface PlaybackState { /* …exact fields from AnimState… */ }

const IDLE_STATE: PlaybackState = { /* …verbatim… */ };

// currentPose / flashActive / shakeOffset / snapshotState — moved verbatim.

export function useBeatPlayback(beat: ResolvedBeat | null, presentationSeed: string): PlaybackState {
  const [state, setState] = useState<PlaybackState>(IDLE_STATE);
  const rafIdRef = useRef<number | null>(null);
  const gameElapsedRef = useRef<number>(0);
  const hitstopWallTimeRef = useRef<number>(0);
  const prevRafTsRef = useRef<number | null>(null);

  useEffect(() => {
    // …the ENTIRE existing effect body, verbatim, with setAnimState → setState…
  }, [beat, presentationSeed]);

  return state;
}
```

Preserve the effect **exactly**, including the `[beat, presentationSeed]` dependency array, the `MAX_SEGMENTS = 8` segmented hitstop loop, and the `remaining > 0.5` guard.

- [ ] **Step 2: Rewrite `FightReplay.tsx` as a thin adapter**

Replace the component body so it delegates all timing to the hook and only maps state → `FighterRig` props (the JSX return + `data-*` attributes stay identical):

```typescript
import type { CSSProperties, JSX } from 'react';
import FighterRig from '../components/FighterRig';
import { useBeatPlayback } from './useBeatPlayback';
import type { ResolvedBeat } from '../domain/combat/beat';

export interface FightReplayProps {
  beat: ResolvedBeat | null;
  playerId?: string;
  playerName: string;
  playerArchetype: string;
  opponentId?: string;
  opponentName: string;
  opponentArchetype: string;
  presentationSeed: string;
}

export default function FightReplay(props: FightReplayProps): JSX.Element {
  const s = useBeatPlayback(props.beat, props.presentationSeed);
  const containerStyle: CSSProperties | undefined =
    s.shakeX !== 0 ? { transform: `translate(${s.shakeX}px, 0)` } : undefined;
  return (
    <div
      data-testid="fight-replay"
      data-playing={s.isPlaying ? 'true' : 'false'}
      data-final-pose-player={s.finalPosePlayer}
      data-final-pose-opponent={s.finalPoseOpponent}
      style={containerStyle}
    >
      <div data-testid="replay-player">
        <FighterRig seed={props.playerId ?? props.playerName} archetype={props.playerArchetype}
          name={props.playerName} pose={s.playerPose} facing="right"
          flashHead={s.flashHeadPlayer} flashBody={s.flashBodyPlayer} downed={s.playerPose === 'down'} />
      </div>
      <div data-testid="replay-opponent">
        <FighterRig seed={props.opponentId ?? props.opponentName} archetype={props.opponentArchetype}
          name={props.opponentName} pose={s.opponentPose} facing="left"
          flashHead={s.flashHeadOpponent} flashBody={s.flashBodyOpponent} downed={s.opponentPose === 'down'} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the characterization test — MUST match the pre-extraction snapshot**

Run: `npx vitest run src/replay/useBeatPlayback.test.ts`
Expected: PASS with **no `-u`**. If the inline snapshot differs, the extraction was NOT verbatim — diff against the pre-extraction FightReplay and restore the exact logic. Do not update the snapshot to make it pass.

- [ ] **Step 4: Run the existing FightReplay + full suite (behavior-identical)**

Run: `npx vitest run src/replay/FightReplay.test.tsx && npx vitest run`
Expected: PASS, same count as Task 1 Step 3 baseline. `FightReplay.test.tsx` is unmodified and still green — proof the adapter preserves the public contract.

- [ ] **Step 5: tsc + build + determinism**

```bash
npx tsc --noEmit && npm run build
npx vitest run && npx vitest run   # two identical runs
```
Expected: tsc 0 errors; build ok; identical pass counts.

- [ ] **Step 6: Commit**

```bash
git add src/replay/useBeatPlayback.ts src/replay/FightReplay.tsx
git commit -m "refactor(M19-A): extract useBeatPlayback hook (verbatim); FightReplay -> thin adapter

Characterization frame-trace unchanged; FightReplay.test.tsx untouched and green.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d"
```

---

## Task 4: Final gate + PR

**Files:** none (verification + PR).

**Interfaces:** Consumes everything above. Produces the open PR for review.

- [ ] **Step 1: Full gate table**

```bash
git rev-parse HEAD; git rev-parse @{u} 2>/dev/null || echo "not pushed yet"
npx vitest run && npx vitest run          # identical counts, byte-identical
npx tsc --noEmit
npm run build
git diff --stat origin/main -- package.json package-lock.json   # expect: empty
git diff --stat origin/main -- src/screens/FightView.tsx src/App.tsx   # expect: empty (dormancy)
grep -rn "from '.*FightReplay'" src/screens src/App.tsx          # expect: 0 (not mounted)
```
Expected: all green; `package.json`/`FightView.tsx`/`App.tsx` unchanged vs `origin/main`; `FightReplay` imported by nothing in the app shell.

- [ ] **Step 2: Verify commit trailers on all new commits**

```bash
git log origin/main..HEAD --format='%H%n%b' | grep -c 'Copilot-Session: db024489'
```
Expected: equals the number of commits on the branch (3 task commits).

- [ ] **Step 3: Push + open PR (DO NOT MERGE)**

```bash
git push -u origin kelvinxxle-m19a-headless-core
```
Open a PR into `main` titled **`M19-A: dormant fight-presentation core + useBeatPlayback extraction`**. Body must state: renderer is unmounted (dormant), no public lab route, no new deps, characterization test proves verbatim extraction, all M18 determinism gates held. **Report HEAD SHA back to the orchestrator; do not merge.**

---

## Self-Review

**1. Spec coverage (against `2026-07-22-live-hybrid-arena-design.md` §6 + §17):**
- §17 "split verified headless core, no FightView mount, no public ReplayLab route, merge dormant" → Task 1 (port + prune) + dormancy guard + Task 4 dormancy diff checks. ✅
- §6 "extract `useBeatPlayback(beat, seed)` VERBATIM, guarded by a frame-trace characterization test FIRST" → Task 2 (characterization first) then Task 3 (verbatim extraction, snapshot must not change). ✅
- §6 "FightReplay → thin compatibility adapter (keeps existing tests green)" → Task 3 Step 2 + Step 4. ✅
- §6 "Do NOT combine hook extraction + kick choreography + arena wiring" → this plan contains ONLY the extraction + dormant landing; move-family mapping, poses, ArenaStage, HybridRig all deferred to M19-B. ✅
- Global: no new deps, determinism preserved, trailers → Tasks 1/3/4 gates. ✅

**2. Placeholder scan:** The only intentional `toMatchInlineSnapshot()` blank is populated by `-u` in Task 2 Step 2 (a deliberate capture step, not a TODO). All other steps contain concrete code/commands. ✅

**3. Type consistency:** `AnimState` → renamed `PlaybackState` consistently across the hook and adapter; field names (`flashHeadPlayer`, `finalPoseOpponent`, `shakeX`, `isPlaying`) match `FightReplay`'s original `data-*` outputs and `FighterRig` props exactly. `useBeatPlayback(beat, presentationSeed)` signature matches the M19-B consumer expectation in the spec. ✅

**Note for the orchestrator:** the exact ported test count (Task 1 Step 3) depends on how many M18 tests lived in the excluded FightView/App files. Record it as the baseline; Tasks 3–4 must reproduce it. Re-fetch `origin/main` before Task 1 in case it advanced past `cd8625c`.
