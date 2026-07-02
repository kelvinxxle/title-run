# M7 — Persistence & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a run survive closing/reopening the app (park & resume to exact state) and give a completed run a payoff by persisting and celebrating the best title reign.

**Architecture:** Add a thin, versioned localStorage adapter (`src/persistence/runStorage.ts`) and pure best-reign helpers (`src/bestReign.ts`). `App` hydrates `run` + `bestReign` from storage on mount and autosaves on every change via `useEffect`. The M6 run-over Hub view gains an additive "new best reign" flourish. One M6-deferred domain hardening (settleFight fail-fast) is folded in as a tracked task.

**Tech Stack:** React 18, TypeScript (strict), Vite, Tailwind, Vitest + @testing-library/react (jsdom).

## Global Constraints

- **Branch off merged `main` @ `1a8ec117834b`** (the M6 squash-merge commit). `main` is branch-protected; open a PR, do not push to main.
- **No new runtime dependencies.** `dependencies` stays exactly `react` + `react-dom`. Do not touch `package.json`/lockfile except if a task explicitly says so (none do).
- **No `Math.random` anywhere.** All randomness derives from the seeded RNG already in the domain.
- **No changes to `src/domain/**` except Task 2** (the explicitly-tracked M6-deferred `settleFight` fail-fast guard). Every other task is additive: new `src/persistence/*`, new `src/bestReign.ts`, plus additive edits to `src/App.tsx` and `src/screens/ChampionshipHubScreen.tsx` and `src/test/setup.ts`.
- **Determinism is sacred.** Do not change any baked fight/run vector or existing test expectation. A resumed run must replay identically to one played straight through.
- **Every commit message MUST end with the trailer** (verbatim, including "App"):
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`
- **Strict TDD:** write the failing test, run it and see it fail for the right reason, write minimal code, see it pass, commit. One behavior at a time.
- **Gate before every commit is considered done:** `npm test` (vitest run) green, `npm run typecheck` clean, `npm run build` ok.

### Reference: existing merged shapes you will consume

From `src/domain` (already exported via the barrel `src/domain/index.ts`, which includes `export * from './run'`):

```ts
// src/domain/run.ts
export type RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'reward' | 'run-over';
export interface RunFighter { name: string; statLine: StatLine; }
export interface RunState {
  seed: string;
  phase: RunPhase;
  fighter: RunFighter | null;
  fightNumber: number;
  carriedDamage: number;
  record: { wins: number; losses: number };
  isChampion: boolean;
  defenses: number;
  fight: FightState | null;
}
export function startRun(seed: string): RunState;          // phase 'drafting', fightNumber 1, all counters 0/null
export function settleFight(run: RunState, fightState: FightState): RunState;

// src/domain/fight.ts
export type FightStatus = 'in-progress' | 'won' | 'lost';
export interface FightOutcome { method: FinishMethod; round: number; winner: Side; } // Side = 'player' | 'opponent'
export interface FightState { /* … */ status: FightStatus; outcome: FightOutcome | null; /* … */ }
export function startFight(args: { seed: string; fightNumber: number; playerStatLine: StatLine; carryInDamage?: number }): FightState; // status 'in-progress', outcome null
```

Current `src/App.tsx` (merged M6) — for reference, Task 6 modifies this:

```tsx
import { useState } from 'react';
import {
  startRun, applyDraft, startNextFight, settleFight, applyReward,
  type RunState, type Reward, type FightState,
} from './domain';
import type { DraftedFighter } from './domain/draft';
import TopAppBar from './components/TopAppBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightScreen from './screens/FightScreen';
import RewardScreen from './screens/RewardScreen';

export interface AppProps { makeSeed?: () => string; }

export default function App({ makeSeed = () => String(Date.now()) }: AppProps) {
  const [run, setRun] = useState<RunState | null>(null);
  const handleStartRun = () => setRun(startRun(makeSeed()));
  const handleDraftComplete = (d: DraftedFighter) => setRun((r) => (r ? applyDraft(r, d) : r));
  const handleEnterFight = () => setRun((r) => (r ? startNextFight(r) : r));
  const handleSettled = (fight: FightState) => setRun((r) => (r ? settleFight(r, fight) : r));
  const handleReward = (reward: Reward) => setRun((r) => (r ? applyReward(r, reward) : r));
  function screen() {
    if (run === null || run.phase === 'pre-fight' || run.phase === 'run-over') {
      return (<ChampionshipHubScreen run={run} onStartRun={handleStartRun} onEnterFight={handleEnterFight} />);
    }
    if (run.phase === 'drafting') return <DraftScreen seed={run.seed} onComplete={handleDraftComplete} />;
    if (run.phase === 'fighting') { if (!run.fighter) return null; return (<FightScreen seed={run.seed} fightNumber={run.fightNumber} fighter={run.fighter} carriedDamage={run.carriedDamage} onSettled={handleSettled} />); }
    return <RewardScreen run={run} onReward={handleReward} />;
  }
  return (<div className="min-h-screen flex flex-col bg-background"><TopAppBar run={run} /><main className="flex-1">{screen()}</main></div>);
}
```

Current `src/screens/ChampionshipHubScreen.tsx` run-over + landing branches (Task 5 modifies):

```tsx
export interface HubProps { run: RunState | null; onStartRun: () => void; onEnterFight: () => void; }
// landing (run === null): <section data-testid="screen-championship-hub"><h1>Title Run</h1><button data-testid="start-run" …>Start New Run</button></section>
// run-over: OutcomeBanner(heading "Run Ended") + <p>Record {wins}–{losses}</p> + <p>Reign {run.defenses}</p> + start-run button
```

Existing test-drive pattern (from `src/App.test.tsx`) — testids you will reuse in Task 6:
`start-run`, `suggested-stat` (×9), `getByLabelText(/fighter name/i)`, button `/confirm fighter/i`, `screen-championship-hub`, `enter-fight`, `intent-strike`, `screen-reward`, `reward-type-bump`, `reward-stat-boxing`, `reward-confirm`, `run-status` (in TopAppBar). Seeded `run-42` fight 1 with `strike ×3` → decision win in round 3 (verified in the merged M6 suite).

---

### Task 1: Commit the M7 design + plan docs

**Files:**
- Create: `docs/superpowers/specs/2026-07-01-m7-persistence-polish-design.md` (the M7 spec — content provided out-of-band by the orchestrator/gist)
- Create: `docs/superpowers/plans/2026-07-01-m7-persistence-polish.md` (this plan — content provided out-of-band)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing code-level; establishes the docs in-repo (mirrors M6 Task 1).

- [ ] **Step 1: Fetch the two documents** from the handoff gist raw URLs the orchestrator provides, and save them to the exact paths above (create the directories if missing).

- [ ] **Step 2: Verify they are complete** (not truncated): open each and confirm the last line of the spec is its final "Open items" bullet and the last line of the plan is the Task 7 commit step.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-01-m7-persistence-polish-design.md docs/superpowers/plans/2026-07-01-m7-persistence-polish.md
git commit -m "docs: M7 persistence & polish spec and implementation plan

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: `settleFight` fail-fast guard (M6-deferred carryover)

Deferred from the M6 review (Copilot PR #7 thread, resolved). `settleFight` currently treats a missing `outcome` as a loss, which would silently permadeath a run if it were ever called with an in-progress fight. Make it fail fast — consistent with `startNextFight`/`rewardDelta`/`applyReward`, which already throw on invalid preconditions. This is the only permitted `src/domain/**` change in M7. No valid win/loss path or determinism vector changes.

**Files:**
- Modify: `src/domain/run.ts` (function `settleFight`, currently ~lines 68–88)
- Test: `src/domain/run.test.ts` (add one test; do not alter existing tests)

**Interfaces:**
- Consumes: `startFight`, `startRun`, `settleFight`, `type RunState` from the domain barrel.
- Produces: `settleFight` now throws `Error('settleFight requires a settled fight')` when `fightState.outcome` is null (i.e. the fight is still `in-progress`). Valid settled inputs behave exactly as before.

- [ ] **Step 1: Write the failing test**

Add this test to `src/domain/run.test.ts`. The file already imports `startRun`/`settleFight` from `./run` and already defines a full `PLAYER` stat line constant — reuse both. The only missing import is `startFight`: add it to the existing `import { durability, resolveRound } from './fight';` line so it reads `import { durability, resolveRound, startFight } from './fight';`.

```ts
it('settleFight throws when given an unsettled (in-progress) fight', () => {
  const run = startRun('run-42');
  const inProgress = startFight({
    seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 0,
  });
  expect(inProgress.outcome).toBeNull();
  expect(() => settleFight(run, inProgress)).toThrow(/settled/i);
});
```

`settleFight`'s guard runs before it reads anything off `run`, so passing the freshly-started run (phase `drafting`) is fine — the point is only that the fight has no outcome.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/run.test.ts -t "unsettled"`
Expected: FAIL — currently `settleFight` returns a `run-over` state (no throw), so `toThrow` fails.

- [ ] **Step 3: Add the guard**

In `src/domain/run.ts`, change the top of `settleFight` from:

```ts
export function settleFight(run: RunState, fightState: FightState): RunState {
  const outcome = fightState.outcome;
  if (!outcome || outcome.winner !== 'player') {
    return { ...run, phase: 'run-over', record: { ...run.record, losses: 1 }, fight: fightState };
  }
```

to:

```ts
export function settleFight(run: RunState, fightState: FightState): RunState {
  const outcome = fightState.outcome;
  if (!outcome) {
    throw new Error('settleFight requires a settled fight');
  }
  if (outcome.winner !== 'player') {
    return { ...run, phase: 'run-over', record: { ...run.record, losses: 1 }, fight: fightState };
  }
```

(The win branch below is unchanged.)

- [ ] **Step 4: Run the full domain suite to verify pass + no regressions**

Run: `npx vitest run src/domain/run.test.ts src/domain/fight.test.ts`
Expected: PASS — the new test passes; every existing win/loss/full-run/baked-vector test still passes (settled inputs unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/domain/run.ts src/domain/run.test.ts
git commit -m "fix: settleFight fails fast on an unsettled fight

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: `runStorage` persistence adapter

**Files:**
- Create: `src/persistence/runStorage.ts`
- Create: `src/persistence/runStorage.test.ts`
- Modify: `src/test/setup.ts` (add a global `afterEach` that clears localStorage so persistence tests are isolated)

**Interfaces:**
- Consumes: `type RunState`, `startRun` from `../domain`.
- Produces:
  - `export const STORAGE_KEY = 'title-run:v1';`
  - `export const SCHEMA_VERSION = 1;`
  - `export interface LoadedState { run: RunState | null; bestReign: number | null; }`
  - `export function load(): LoadedState;` — returns `{ run, bestReign }`; on any failure (no key, bad JSON, wrong version, unknown `run.phase`, or a thrown localStorage) returns `{ run: null, bestReign: null }` and best-effort clears the key.
  - `export function save(state: { run: RunState | null; bestReign: number | null }): void;` — writes `{ version: SCHEMA_VERSION, run, bestReign }` as JSON; never throws (swallows localStorage errors).

- [ ] **Step 1: Make persistence tests isolated** — modify `src/test/setup.ts`

Current file is just `import '@testing-library/jest-dom';`. Append:

```ts
import { afterEach } from 'vitest';

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore environments without localStorage
  }
});
```

- [ ] **Step 2: Write the failing tests**

Create `src/persistence/runStorage.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { load, save, STORAGE_KEY, SCHEMA_VERSION } from './runStorage';
import { startRun } from '../domain';

describe('runStorage', () => {
  it('round-trips run + bestReign', () => {
    const run = startRun('run-42');
    save({ run, bestReign: 3 });
    expect(load()).toEqual({ run, bestReign: 3 });
  });

  it('returns defaults when storage is empty', () => {
    expect(load()).toEqual({ run: null, bestReign: null });
  });

  it('returns defaults and clears the key on malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(load()).toEqual({ run: null, bestReign: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns defaults on a wrong schema version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION + 1, run: startRun('x'), bestReign: 1 }));
    expect(load()).toEqual({ run: null, bestReign: null });
  });

  it('returns defaults on an unknown run phase', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: { ...startRun('x'), phase: 'bogus' }, bestReign: 1 }));
    expect(load()).toEqual({ run: null, bestReign: null });
  });

  it('accepts a persisted run === null (no active run)', () => {
    save({ run: null, bestReign: 5 });
    expect(load()).toEqual({ run: null, bestReign: 5 });
  });

  it('save does not throw when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => save({ run: startRun('x'), bestReign: null })).not.toThrow();
    spy.mockRestore();
  });

  it('load returns defaults when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(load()).toEqual({ run: null, bestReign: null });
    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/persistence/runStorage.test.ts`
Expected: FAIL — module `./runStorage` does not exist yet.

- [ ] **Step 4: Write the minimal implementation**

Create `src/persistence/runStorage.ts`:

```ts
import type { RunState, RunPhase } from '../domain';

export const STORAGE_KEY = 'title-run:v1';
export const SCHEMA_VERSION = 1;

export interface LoadedState {
  run: RunState | null;
  bestReign: number | null;
}

const DEFAULTS: LoadedState = { run: null, bestReign: null };

const KNOWN_PHASES: RunPhase[] = ['drafting', 'pre-fight', 'fighting', 'reward', 'run-over'];

function isValidRun(run: unknown): run is RunState | null {
  if (run === null) return true;
  if (typeof run !== 'object') return false;
  const phase = (run as { phase?: unknown }).phase;
  return typeof phase === 'string' && (KNOWN_PHASES as string[]).includes(phase);
}

export function load(): LoadedState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULTS;
  }
  if (raw === null) return DEFAULTS;

  try {
    const parsed = JSON.parse(raw) as { version?: unknown; run?: unknown; bestReign?: unknown };
    if (parsed.version !== SCHEMA_VERSION || !isValidRun(parsed.run)) {
      clearKey();
      return DEFAULTS;
    }
    const bestReign = typeof parsed.bestReign === 'number' ? parsed.bestReign : null;
    return { run: (parsed.run as RunState | null), bestReign };
  } catch {
    clearKey();
    return DEFAULTS;
  }
}

export function save(state: { run: RunState | null; bestReign: number | null }): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, run: state.run, bestReign: state.bestReign }),
    );
  } catch {
    // degrade gracefully (private mode / quota / unavailable) — in-memory only this session
  }
}

function clearKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
```

Note: `RunPhase` must be exported from the domain barrel. It is (`export * from './run'`, and `run.ts` declares `export type RunPhase`). If `import { type RunPhase }` from `../domain` fails typecheck, import it from `../domain/run` instead.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/persistence/runStorage.test.ts`
Expected: PASS (all 8).

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/persistence/runStorage.ts src/persistence/runStorage.test.ts src/test/setup.ts
git commit -m "feat: add versioned localStorage run persistence with safe fallback

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Best-reign helpers

**Files:**
- Create: `src/bestReign.ts`
- Create: `src/bestReign.test.ts`

**Interfaces:**
- Consumes: `type RunState` from `./domain`.
- Produces:
  - `export function isNewRecord(bestReign: number | null, run: RunState): boolean;` — true when `run.isChampion && (bestReign === null || run.defenses > bestReign)`. (Caller gates on `phase === 'run-over'`.)
  - `export function commitReign(bestReign: number | null, endedRun: RunState): number | null;` — if `endedRun.isChampion`, returns `bestReign === null ? endedRun.defenses : Math.max(bestReign, endedRun.defenses)`; otherwise returns `bestReign` unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/bestReign.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isNewRecord, commitReign } from './bestReign';
import { startRun, type RunState } from './domain';

function runOver(partial: Partial<RunState>): RunState {
  return { ...startRun('x'), phase: 'run-over', ...partial };
}

describe('isNewRecord', () => {
  it('first belt (0 defenses) is a record when no prior best', () => {
    expect(isNewRecord(null, runOver({ isChampion: true, defenses: 0 }))).toBe(true);
  });
  it('a longer reign beats the stored best', () => {
    expect(isNewRecord(1, runOver({ isChampion: true, defenses: 2 }))).toBe(true);
  });
  it('an equal reign is NOT a record (strict >)', () => {
    expect(isNewRecord(2, runOver({ isChampion: true, defenses: 2 }))).toBe(false);
  });
  it('a non-champion ending is never a record', () => {
    expect(isNewRecord(null, runOver({ isChampion: false, defenses: 0 }))).toBe(false);
  });
});

describe('commitReign', () => {
  it('records the first reign when best is null', () => {
    expect(commitReign(null, runOver({ isChampion: true, defenses: 0 }))).toBe(0);
  });
  it('keeps the max of prior best and this reign', () => {
    expect(commitReign(3, runOver({ isChampion: true, defenses: 2 }))).toBe(3);
    expect(commitReign(1, runOver({ isChampion: true, defenses: 2 }))).toBe(2);
  });
  it('leaves best unchanged for a non-champion ending', () => {
    expect(commitReign(4, runOver({ isChampion: false, defenses: 0 }))).toBe(4);
    expect(commitReign(null, runOver({ isChampion: false, defenses: 0 }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/bestReign.test.ts`
Expected: FAIL — module `./bestReign` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `src/bestReign.ts`:

```ts
import type { RunState } from './domain';

export function isNewRecord(bestReign: number | null, run: RunState): boolean {
  return run.isChampion && (bestReign === null || run.defenses > bestReign);
}

export function commitReign(bestReign: number | null, endedRun: RunState): number | null {
  if (!endedRun.isChampion) return bestReign;
  return bestReign === null ? endedRun.defenses : Math.max(bestReign, endedRun.defenses);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/bestReign.test.ts`
Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
git add src/bestReign.ts src/bestReign.test.ts
git commit -m "feat: add best-reign record + commit helpers

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Hub best-reign line + new-record flourish

Additive UI on `ChampionshipHubScreen`: two optional props, a best-reign line on the landing and run-over views, and a "new best reign" flourish on run-over. No change to climb/title/champion/pre-fight views or existing callbacks.

**Files:**
- Modify: `src/screens/ChampionshipHubScreen.tsx`
- Test: `src/screens/ChampionshipHubScreen.test.tsx` (add tests; do not alter existing ones)

**Interfaces:**
- Consumes: `isNewRecord` semantics from Task 4 (via the `isNewRecord` prop, computed by the App in Task 6). This task renders props only; it does not import `bestReign.ts`.
- Produces: `HubProps` gains `bestReign?: number | null` and `isNewRecord?: boolean`. New testids: `best-reign`, `new-record`.

- [ ] **Step 1: Write the failing tests**

Add to `src/screens/ChampionshipHubScreen.test.tsx` (match the file's existing import style; you need a helper to build a run-over `RunState` — reuse the file's existing pattern or `startRun` + spread):

```ts
import { startRun, type RunState } from '../domain';

function runOver(partial: Partial<RunState>): RunState {
  return { ...startRun('x'), phase: 'run-over', ...partial };
}

it('run-over shows the new-record flourish when isNewRecord', () => {
  render(<ChampionshipHubScreen run={runOver({ isChampion: true, defenses: 2 })} bestReign={1} isNewRecord onStartRun={() => {}} onEnterFight={() => {}} />);
  expect(screen.getByTestId('new-record')).toBeInTheDocument();
});

it('run-over hides the flourish when not a record', () => {
  render(<ChampionshipHubScreen run={runOver({ isChampion: false, defenses: 0 })} bestReign={2} isNewRecord={false} onStartRun={() => {}} onEnterFight={() => {}} />);
  expect(screen.queryByTestId('new-record')).toBeNull();
});

it('shows the best-reign number to beat on the landing', () => {
  render(<ChampionshipHubScreen run={null} bestReign={3} onStartRun={() => {}} onEnterFight={() => {}} />);
  expect(screen.getByTestId('best-reign')).toHaveTextContent(/best reign: 3/i);
});

it('shows "No title yet" on the landing when best is null', () => {
  render(<ChampionshipHubScreen run={null} bestReign={null} onStartRun={() => {}} onEnterFight={() => {}} />);
  expect(screen.getByTestId('best-reign')).toHaveTextContent(/no title yet/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/screens/ChampionshipHubScreen.test.tsx -t "record\|best-reign\|No title"`
Expected: FAIL — props/testids don't exist yet.

- [ ] **Step 3: Implement the additive props + rendering**

In `src/screens/ChampionshipHubScreen.tsx`:

1. Extend the props interface:

```tsx
export interface HubProps {
  run: RunState | null;
  onStartRun: () => void;
  onEnterFight: () => void;
  bestReign?: number | null;
  isNewRecord?: boolean;
}
```

2. Destructure the new props with defaults:

```tsx
export default function ChampionshipHubScreen({ run, onStartRun, onEnterFight, bestReign = null, isNewRecord = false }: HubProps) {
```

3. Add a shared best-reign line helper near the top of the component body:

```tsx
const bestReignLine = (
  <p data-testid="best-reign">
    {bestReign === null ? 'No title yet' : `Best reign: ${bestReign}`}
  </p>
);
```

4. In the **landing** branch (`run === null`), insert `{bestReignLine}` after the `<h1>Title Run</h1>` and before the start-run button.

5. In the **run-over** branch, add the flourish and the best-reign line. It becomes:

```tsx
if (run.phase === 'run-over') {
  return (
    <section data-testid="screen-championship-hub">
      {run.fight?.outcome && <OutcomeBanner outcome={run.fight.outcome} heading="Run Ended" />}
      {isNewRecord && <p data-testid="new-record">★ New best reign!</p>}
      <p>Record {run.record.wins}–{run.record.losses}</p>
      <p>Reign {run.defenses}</p>
      {bestReignLine}
      <button data-testid="start-run" onClick={onStartRun}>Start New Run</button>
    </section>
  );
}
```

(The unconditional `<p>Reign {run.defenses}</p>` from M6 stays as-is.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/screens/ChampionshipHubScreen.test.tsx`
Expected: PASS — new tests pass; every existing Hub test still passes.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/screens/ChampionshipHubScreen.tsx src/screens/ChampionshipHubScreen.test.tsx
git commit -m "feat: show best reign and celebrate a new record on the hub

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: App hydrate + autosave + best-reign commit

Wire persistence and best-reign into the controller. Hydrate `run` + `bestReign` from storage once on mount; autosave on every change; commit the just-ended reign at "Start New Run"; pass `bestReign` + the derived `isNewRecord` to the Hub. **Do not put any side effect inside a `setState` updater** (StrictMode double-invokes updaters — see the M6 DraftScreen fix).

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx` (add tests; keep the existing run-loop test intact)

**Interfaces:**
- Consumes: `load`, `save` from `./persistence/runStorage`; `isNewRecord`, `commitReign` from `./bestReign`; existing domain functions.
- Produces: no new exports; `App` now persists and celebrates.

- [ ] **Step 1: Write the failing tests**

Add to `src/App.test.tsx`:

```ts
import { STORAGE_KEY } from './persistence/runStorage';

it('autosaves the run to localStorage after a transition', () => {
  render(<App makeSeed={() => 'run-42'} />);
  fireEvent.click(screen.getByTestId('start-run'));
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(saved.version).toBe(1);
  expect(saved.run.phase).toBe('drafting');
  expect(saved.run.seed).toBe('run-42');
});

it('hydrates the exact phase from a saved blob on mount', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    run: { seed: 'run-42', phase: 'pre-fight', fighter: { name: 'Kelvin', statLine: SAMPLE_STAT_LINE }, fightNumber: 3, carriedDamage: 0, record: { wins: 2, losses: 0 }, isChampion: false, defenses: 0, fight: null },
    bestReign: null,
  }));
  render(<App makeSeed={() => 'unused'} />);
  expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
  expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 3/i);
});

it('celebrates a new best reign on a champion run-over and commits it on Start New Run', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    run: { seed: 'run-42', phase: 'run-over', fighter: null, fightNumber: 6, carriedDamage: 0, record: { wins: 5, losses: 1 }, isChampion: true, defenses: 2, fight: { outcome: { method: 'decision', round: 5, winner: 'opponent' } } },
    bestReign: 1,
  }));
  render(<App makeSeed={() => 'next-run'} />);
  expect(screen.getByTestId('new-record')).toBeInTheDocument();

  fireEvent.click(screen.getByTestId('start-run'));
  // now drafting a fresh run; the reign was committed to max(1, 2) = 2
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(saved.bestReign).toBe(2);
  expect(saved.run.phase).toBe('drafting');
  expect(screen.queryByTestId('new-record')).toBeNull();
});
```

`SAMPLE_STAT_LINE`: build a full `StatLine` for the hydration test. Use the domain's stat ids — at the top of the test file add:

```ts
import { STAT_IDS } from './domain';
const SAMPLE_STAT_LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 50])) as import('./domain').StatLine;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — App doesn't persist/hydrate/celebrate yet (no `new-record`, localStorage empty after transition, no hydration).

- [ ] **Step 3: Rewrite `App` to hydrate, autosave, and celebrate**

Replace the body of `src/App.tsx` with (keeping imports additive):

```tsx
import { useEffect, useState } from 'react';
import {
  startRun, applyDraft, startNextFight, settleFight, applyReward,
  type RunState, type Reward, type FightState,
} from './domain';
import type { DraftedFighter } from './domain/draft';
import { load, save } from './persistence/runStorage';
import { isNewRecord as computeIsNewRecord, commitReign } from './bestReign';
import TopAppBar from './components/TopAppBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightScreen from './screens/FightScreen';
import RewardScreen from './screens/RewardScreen';

export interface AppProps { makeSeed?: () => string; }

export default function App({ makeSeed = () => String(Date.now()) }: AppProps) {
  const [store] = useState(() => load());
  const [run, setRun] = useState<RunState | null>(store.run);
  const [bestReign, setBestReign] = useState<number | null>(store.bestReign);

  useEffect(() => {
    save({ run, bestReign });
  }, [run, bestReign]);

  const handleStartRun = () => {
    if (run && run.phase === 'run-over') {
      setBestReign((b) => commitReign(b, run));
    }
    setRun(startRun(makeSeed()));
  };
  const handleDraftComplete = (d: DraftedFighter) => setRun((r) => (r ? applyDraft(r, d) : r));
  const handleEnterFight = () => setRun((r) => (r ? startNextFight(r) : r));
  const handleSettled = (fight: FightState) => setRun((r) => (r ? settleFight(r, fight) : r));
  const handleReward = (reward: Reward) => setRun((r) => (r ? applyReward(r, reward) : r));

  const showNewRecord = run !== null && run.phase === 'run-over' && computeIsNewRecord(bestReign, run);

  function screen() {
    if (run === null || run.phase === 'pre-fight' || run.phase === 'run-over') {
      return (
        <ChampionshipHubScreen
          run={run}
          bestReign={bestReign}
          isNewRecord={showNewRecord}
          onStartRun={handleStartRun}
          onEnterFight={handleEnterFight}
        />
      );
    }
    if (run.phase === 'drafting') return <DraftScreen seed={run.seed} onComplete={handleDraftComplete} />;
    if (run.phase === 'fighting') {
      if (!run.fighter) return null;
      return (
        <FightScreen
          seed={run.seed}
          fightNumber={run.fightNumber}
          fighter={run.fighter}
          carriedDamage={run.carriedDamage}
          onSettled={handleSettled}
        />
      );
    }
    return <RewardScreen run={run} onReward={handleReward} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopAppBar run={run} />
      <main className="flex-1">{screen()}</main>
    </div>
  );
}
```

Notes for the implementer:
- `handleStartRun` reads `run` from the current render's closure (not from a `setState` updater), so committing the reign has **no side effect inside an updater** — this is deliberate and required.
- `useState(() => load())` runs `load()` exactly once on mount; `run`/`bestReign` seed from it. Do not call `load()` in more than one initializer.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS — the existing run-loop test and the three new tests all pass. (Auto-cleanup between tests plus the `localStorage.clear()` in setup keep them isolated.)

- [ ] **Step 5: Full gate + commit**

```bash
npm test
npm run typecheck
npm run build
git add src/App.tsx src/App.test.tsx
git commit -m "feat: hydrate, autosave, and commit best reign in the app controller

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: End-to-end park & resume integration test

A single real-`App` test proving the headline promise: play a run, close (unmount), reopen (fresh mount), resume to the exact state. Uses only fight 1's known deterministic outcome (`strike ×3` → decision win), then parks at pre-fight fight 2 — no unverified multi-fight vectors.

**Files:**
- Create: `src/e2e.resume.test.tsx`

**Interfaces:**
- Consumes: real `App`, `STORAGE_KEY`.
- Produces: nothing; a determinism/resume lock.

- [ ] **Step 1: Write the failing test**

Create `src/e2e.resume.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from './App';
import { STORAGE_KEY } from './persistence/runStorage';

describe('park & resume (end to end)', () => {
  it('resumes to the exact state after an unmount/remount', () => {
    // ---- play: landing → draft → win fight 1 → reward → park at pre-fight fight 2 ----
    render(<App makeSeed={() => 'run-42'} />);
    fireEvent.click(screen.getByTestId('start-run'));
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByTestId('suggested-stat'));
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));
    fireEvent.click(screen.getByTestId('enter-fight'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    fireEvent.click(screen.getByTestId('reward-confirm'));

    // parked at the hub, fight 2, with the win recorded
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 2/i);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.run.phase).toBe('pre-fight');
    expect(saved.run.fightNumber).toBe(2);
    expect(saved.run.record.wins).toBe(1);

    // ---- close the app ----
    cleanup();
    expect(screen.queryByTestId('screen-championship-hub')).toBeNull();

    // ---- reopen: fresh mount hydrates from localStorage (makeSeed must NOT be used) ----
    render(<App makeSeed={() => { throw new Error('makeSeed should not run on resume'); }} />);
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 2/i);
    expect(screen.getByTestId('enter-fight')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/e2e.resume.test.tsx`
Expected: initially FAIL only if earlier tasks are incomplete; after Tasks 3–6 it should pass. If it fails, read the assertion — do NOT change baked behavior; fix the wiring in the responsible task.

- [ ] **Step 3: Make it pass**

No new production code should be required — Tasks 3–6 already implement hydrate + autosave. If `makeSeed should not run on resume` throws, it means `App` is calling `makeSeed` on mount instead of hydrating `run` from storage; re-check the `useState(() => load())` seeding in Task 6.

- [ ] **Step 4: Full gate**

Run: `npm test && npm run typecheck && npm run build`
Expected: ALL green — full suite (M1–M6 + all M7 tasks) passes, types clean, build ok.

- [ ] **Step 5: Commit**

```bash
git add src/e2e.resume.test.tsx
git commit -m "test: end-to-end park and resume to exact state

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Final verification (before opening the PR)

- [ ] `npm test` — entire suite green (M1–M6 unchanged + all new M7 tests).
- [ ] `npm run typecheck` — clean.
- [ ] `npm run build` — succeeds.
- [ ] `grep -rn "Math.random" src` — no matches.
- [ ] `git log` — every M7 commit ends with the exact `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` trailer.
- [ ] `git diff --stat main` — changes confined to: `docs/superpowers/**`, `src/persistence/**`, `src/bestReign*.ts`, `src/App.tsx`/`src/App.test.tsx`, `src/screens/ChampionshipHubScreen.tsx`/test, `src/test/setup.ts`, `src/e2e.resume.test.tsx`, and the single Task 2 `src/domain/run.ts`/`run.test.ts` change. No `package.json`/lockfile changes.
- [ ] Open a PR into `main`; do **not** merge (the orchestrator runs GPT-5.5 xhigh + Copilot review, then merges).

## Spec coverage map

- Park & resume to exact state → Tasks 3 (storage), 6 (hydrate/autosave), 7 (e2e).
- Best-reign memory + celebration → Tasks 4 (helpers), 5 (Hub flourish + number-to-beat), 6 (commit at Start New Run + derive isNewRecord).
- Robust/invisible persistence (corruption, version, unavailable) → Task 3.
- Mid-draft resume = restart-from-seed → satisfied by design (parking in `drafting` persists `run.seed`; `DraftScreen` re-inits from the seed on remount — no code needed; the e2e parks at pre-fight to keep the test on known vectors).
- settleFight fail-fast (M6 carryover) → Task 2.
- No new deps / no Math.random / determinism preserved → Global Constraints + final verification.
