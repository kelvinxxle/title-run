# M6 — Run/Streak + Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-bout demo into a persistent roguelike run: draft a fighter, climb a 5-fight ladder to the belt, earn a reward between fights (stat bump / re-roll / recover), defend the title across 5-round bouts, and end the run on the first loss — all driven by a pure, serializable run-state machine.

**Architecture:** A new pure domain module `src/domain/run.ts` owns a serializable `RunState` machine (phases `drafting → pre-fight → fighting → reward → run-over`). `App.tsx` becomes a thin controller that renders one screen per phase and never holds fight/draft logic itself. The Fight and Reward and Hub screens become **controlled** components (all state via props + callbacks). The one engine change folds `fightNumber` into the round RNG stream so each fight in a run is independent; this re-bakes exactly two baked-vector tests.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind; Vitest + React Testing Library (globals, jsdom, `./src/test/setup.ts`, `css:false`). No backend, no persistence yet (M7). No new dependencies (runtime deps stay exactly `react`, `react-dom`).

## Global Constraints

- **Branch off `origin/main` @ `184a827`** (the M5 merge). main is branch-protected; open a PR, never merge without explicit user consent.
- **No new dependencies.** `package.json` runtime deps stay `react` + `react-dom` only. No new devDeps.
- **No `Math.random`** anywhere. All randomness flows through `createRng` from `src/domain/rng.ts`.
- **Every commit** ends with the trailer, exactly:
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`
- **Strict TDD:** write the failing test, run it, watch it fail for the expected reason, implement minimally, watch it pass, commit. One behavior per cycle.
- **Domain public API is unchanged except one line:** the round RNG seed in `resolveRound` gains `#f${fightNumber}`. Do not change any other domain signature. Add `run.ts` to the barrel.
- **Commands** (from repo root): tests `npm test` (vitest run), types `npm run typecheck` (`tsc --noEmit`), build `npm run build` (`tsc -b && vite build`). Run a single test file with `npm test -- src/path/File.test.tsx`.
- **TypeScript strict** — no `any`, no non-null `!` on values that can be null at the type level; guard instead.
- **Determinism:** identical seed ⇒ identical run. All vectors in this plan are computed against merged `origin/main` @ `184a827` and must reproduce exactly.

---

## File map

**Create:**
- `src/domain/run.ts` — run-state machine (types + transitions + reward model). Pure, serializable.
- `src/domain/run.test.ts` — unit tests (constructed `FightState` literals; no live RNG for state-machine tests).
- `docs/superpowers/specs/2026-07-01-m6-run-rewards-design.md` — the approved spec (copied into repo).
- `docs/superpowers/plans/2026-07-01-m6-run-rewards.md` — this plan (copied into repo).
- `src/components/OutcomeBanner.tsx` + `src/components/OutcomeBanner.test.tsx` — repurposed from `FightResultPanel` (button removed).

**Modify:**
- `src/domain/fight.ts` — one line in `resolveRound` (fold `fightNumber` into round stream).
- `src/domain/fight.test.ts` — re-bake exactly the 2 exact-vector tests + add the isolation test. Leave property/invariant tests untouched.
- `src/domain/index.ts` — add `export * from './run';`.
- `src/screens/FightScreen.tsx` + `src/screens/FightScreen.test.tsx` — make controlled (props: seed, fightNumber, fighter, carriedDamage?, onSettled). Drop demo fighter, self-seed, New Fight button, `FightResultPanel` import.
- `src/screens/RewardScreen.tsx` — placeholder → real controlled two-step reward screen.
- `src/screens/ChampionshipHubScreen.tsx` — placeholder → real controlled hub (landing / climb / title / champion / run-over).
- `src/screens/DraftScreen.tsx` — fold 3 carryover nits + wire `onComplete` seam test.
- `src/components/TopAppBar.tsx` — add `{run}` prop + exported `runStatusLabel(run)`.
- `src/App.tsx` + `src/App.test.tsx` — controller rewrite; delete BottomNavBar usage; one-loop UI integration test.

**Delete:**
- `src/components/BottomNavBar.tsx` (+ its test if present)
- `src/navigation/screens.ts` + `src/navigation/screens.test.ts`
- `src/components/FightResultPanel.tsx` + `src/components/FightResultPanel.test.tsx` (renamed → OutcomeBanner; done in Task 7 after Task 6 removes the last import)

---

## Domain reference (verified against `origin/main` @ 184a827)

These exist already — consume them, do not redefine:

- `rng.ts`: `createRng(seed: string | number)`, `rng.randInt(min,max)`, `rng.pick(arr)`, `rng.shuffle(arr)`.
- `stats.ts`: `STAT_IDS: StatId[]` (9), `STAT_LABELS: Record<StatId,string>`, `type StatLine = Record<StatId, number>`, `STAT_MIN=1`, `STAT_MAX=99`, `clampStat(n): number`, `isStatId(x: unknown): x is StatId`.
- `roster.ts`: `ROSTER`, `buildStatLine(fighter)`, `rollFighter(rng, excludeIds: string[] = [])`, `getFighter(id)`.
- `draft.ts`: `startDraft(seed)`, `keepStat(state, statId)`, `nameFighter(state, name)`, `getDraftedFighter(state): DraftedFighter`, `suggestedStatId(state)`, `availableStatIds(state)`, `filledCount(state)`; `type DraftedFighter = { name: string; statLine: StatLine; slots: ... }`.
- `fight.ts`: `type Intent`, `type FightState`, `type FightOutcome`, `startFight(args: StartFightArgs)`, `resolveRound(state, intent)` (THROWS if `state.status !== 'in-progress'`), `roundsForFight(n)` (≤4 ⇒ 3, else 5), `durability(sl) = round(50 + chin*0.5)`, `carryOutDamage(state)` (throws if fight not won by player).
- `opponent.ts`: `type Opponent = { id; name; style; statLine }`, `generateOpponent(seed, fightNumber)` (stream `${seed}#opp${fightNumber}` — UNCHANGED by this milestone), `targetRating`.
- `domain/index.ts`: barrel re-exporting stats/archetypes/rng/roster/opponent/fight.

**PLAYER stat line** (the always-keep-suggested draft for seed `'run-42'`, used across tests):
```ts
{ boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 }
```
`durability(PLAYER) = round(50 + 88*0.5) = 94`.

---

### Task 1: Docs — copy spec + plan into the repo

**Files:**
- Create: `docs/superpowers/specs/2026-07-01-m6-run-rewards-design.md`
- Create: `docs/superpowers/plans/2026-07-01-m6-run-rewards.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing code-facing. Establishes the paper trail the reviewer reads.

- [ ] **Step 1: Add the spec and plan docs**

Copy the approved spec verbatim into `docs/superpowers/specs/2026-07-01-m6-run-rewards-design.md`, and this plan into `docs/superpowers/plans/2026-07-01-m6-run-rewards.md`. (The handoff gist contains both raw files; save them unchanged.)

- [ ] **Step 2: Verify no code changed**

Run: `git status --porcelain`
Expected: only the two new files under `docs/superpowers/` appear as untracked.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-01-m6-run-rewards-design.md docs/superpowers/plans/2026-07-01-m6-run-rewards.md
git commit -m "docs: M6 run/rewards spec and implementation plan

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Fold `fightNumber` into the round RNG stream + re-bake vectors

**Why:** In a run, each fight must resolve independently. Today `resolveRound` seeds the round RNG with `${state.seed}#r${state.round}`, so two fights with the same round number and identical states draw identically. Folding `fightNumber` in makes each fight independent. This changes exactly two baked exact-vector tests; property/invariant tests must still pass unchanged.

**Files:**
- Modify: `src/domain/fight.ts` (the `resolveRound` round-RNG line)
- Modify: `src/domain/fight.test.ts` (add isolation test; re-bake 2 exact-vector tests)

**Interfaces:**
- Consumes: existing `FightState` (already has `seed`, `fightNumber`, `round`), `resolveRound`, `startFight`.
- Produces: no signature change. `resolveRound` behavior now depends on `state.fightNumber`.

- [ ] **Step 1: Write the failing isolation test**

Add to `src/domain/fight.test.ts` (inside the top-level `describe`):

```ts
it('resolves the same round differently across fight numbers (fight isolation)', () => {
  const base = startFight({
    seed: 'iso',
    fightNumber: 1,
    playerStatLine: PLAYER,       // reuse the PLAYER literal already in this test file
    carryInDamage: 0,
  });
  const other = { ...base, fightNumber: 2 };

  const a = resolveRound(base, 'strike');
  const b = resolveRound(other, 'strike');

  // Same seed/round/opponent/player, different fightNumber -> different dominance.
  expect(a.rounds[0].dominance).not.toBe(b.rounds[0].dominance);
});
```

> If `PLAYER` is not already a shared literal in this file, define it at the top of the test file (values from the Domain reference above).

- [ ] **Step 2: Run it — expect RED**

Run: `npm test -- src/domain/fight.test.ts`
Expected: the isolation test FAILS (both dominances equal ⇒ `.not.toBe` fails). Other tests currently pass.

- [ ] **Step 3: Make the one-line engine change**

In `src/domain/fight.ts`, inside `resolveRound`, change the round RNG seed:

```ts
// before
const rng = createRng(`${state.seed}#r${state.round}`);
// after
const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}`);
```

(Only that string changes. Everything else in `resolveRound` stays identical.)

- [ ] **Step 4: Run — isolation test GREEN, two exact-vector tests now RED**

Run: `npm test -- src/domain/fight.test.ts`
Expected: isolation test PASSES. The two baked exact-vector tests FAIL (their numbers shifted). Property/invariant tests still PASS.

- [ ] **Step 5: Re-bake exact-vector test #1 (run-42 fight 1 strike)**

Find the test asserting the exact strike vectors for `startFight({seed:'run-42', fightNumber:1, playerStatLine:PLAYER, carryInDamage:0})` with three `'strike'` rounds. Update its baked arrays:

```ts
// dominance per round: 30,40,25  ->  32,36,32
// opponentDamage per round: 18,42,57  ->  19,41,60
// outcome unchanged: decision win, round 3
```
Replace the old literals with the new ones; leave the outcome assertions (decision, round 3, winner player) as-is.

- [ ] **Step 6: Re-bake exact-vector test #2 (WEAK fighter, fight 6, opponent finishes)**

Find the test where a WEAK fighter (all stats 40) fights at `fightNumber: 6` and the opponent finishes by their style method. Update:

```ts
// cumulative opponentDamage: [23,40,66,80]  ->  [28,54,79]
// finishing index i: 4  ->  3
// outcome round: 4  ->  3
// unchanged: method 'KO', winner opponent, opponent "Lars \"The Surgeon\" Rivas" (brawler)
```

- [ ] **Step 7: Run the whole domain suite — all GREEN**

Run: `npm test -- src/domain/fight.test.ts`
Expected: PASS (isolation test + both re-baked vectors + all untouched property/invariant tests).

Run: `npm test`
Expected: whole suite PASS except FightScreen/App integration tests that assert the *old* fight-1 vector — those are handled in Tasks 6 and 11. If any *domain* test other than the two re-baked ones fails, STOP and report (the change was supposed to be invariant-preserving).

> Sanity note for the implementer: the run-42 fight-1 outcome (decision win, round 3, opponent "Hideo \"Granite\" Stone", grappler) is **unchanged** — only the per-round dominance/damage numbers moved. So `FightScreen.test.tsx`'s seeded outcome assertions still hold; only exact per-number domain assertions moved.

- [ ] **Step 8: Commit**

```bash
git add src/domain/fight.ts src/domain/fight.test.ts
git commit -m "feat: seed round RNG per fight number for run independence

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: `run.ts` — types, `startRun`, `applyDraft` (+ JSON round-trip)

**Files:**
- Create: `src/domain/run.ts`
- Create: `src/domain/run.test.ts`

**Interfaces:**
- Consumes: `StatLine`, `StatId` from `./stats`; `FightState` from `./fight`.
- Produces:
  - `type RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'reward' | 'run-over'`
  - `interface RunFighter { name: string; statLine: StatLine }`
  - `interface RunState { seed: string; phase: RunPhase; fighter: RunFighter | null; fightNumber: number; carriedDamage: number; record: { wins: number; losses: number }; isChampion: boolean; defenses: number; fight: FightState | null }`
  - `const TITLE_FIGHT = 5; const BUMP_AMOUNT = 8; const RECOVER_FRACTION = 0.5`
  - `startRun(seed: string): RunState`
  - `applyDraft(run: RunState, fighter: { name: string; statLine: StatLine }): RunState`

- [ ] **Step 1: Write failing tests for `startRun` + `applyDraft` + serializability**

```ts
import { describe, it, expect } from 'vitest';
import { startRun, applyDraft, type RunState } from './run';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

describe('startRun', () => {
  it('begins a run in the drafting phase with no fighter', () => {
    const run = startRun('run-42');
    expect(run).toEqual({
      seed: 'run-42',
      phase: 'drafting',
      fighter: null,
      fightNumber: 1,
      carriedDamage: 0,
      record: { wins: 0, losses: 0 },
      isChampion: false,
      defenses: 0,
      fight: null,
    });
  });

  it('is JSON round-trippable', () => {
    const run = startRun('run-42');
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe('applyDraft', () => {
  it('stores the fighter and advances to pre-fight', () => {
    const run = applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER });
    expect(run.phase).toBe('pre-fight');
    expect(run.fighter).toEqual({ name: 'Kelvin', statLine: PLAYER });
    expect(run.fightNumber).toBe(1);
  });

  it('accepts a DraftedFighter shape and ignores extra fields like slots', () => {
    const drafted = { name: 'Kelvin', statLine: PLAYER, slots: {} } as unknown as { name: string; statLine: typeof PLAYER };
    const run = applyDraft(startRun('run-42'), drafted);
    expect(run.fighter).toEqual({ name: 'Kelvin', statLine: PLAYER });
  });

  it('does not mutate the input run', () => {
    const run = startRun('run-42');
    applyDraft(run, { name: 'Kelvin', statLine: PLAYER });
    expect(run.phase).toBe('drafting');
    expect(run.fighter).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/domain/run.test.ts`
Expected: FAIL, cannot find module `./run` / exports undefined.

- [ ] **Step 3: Implement the types + the two transitions**

```ts
import type { StatId, StatLine } from './stats';
import type { FightState } from './fight';

export type RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'reward' | 'run-over';

export interface RunFighter {
  name: string;
  statLine: StatLine;
}

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

export const TITLE_FIGHT = 5;
export const BUMP_AMOUNT = 8;
export const RECOVER_FRACTION = 0.5;

export function startRun(seed: string): RunState {
  return {
    seed,
    phase: 'drafting',
    fighter: null,
    fightNumber: 1,
    carriedDamage: 0,
    record: { wins: 0, losses: 0 },
    isChampion: false,
    defenses: 0,
    fight: null,
  };
}

export function applyDraft(
  run: RunState,
  fighter: { name: string; statLine: StatLine },
): RunState {
  return {
    ...run,
    phase: 'pre-fight',
    fighter: { name: fighter.name, statLine: fighter.statLine },
  };
}
```

- [ ] **Step 4: Run — expect GREEN**

Run: `npm test -- src/domain/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/run.ts src/domain/run.test.ts
git commit -m "feat: add run state machine with startRun and applyDraft

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: `run.ts` — `startNextFight` + `settleFight`

**Files:**
- Modify: `src/domain/run.ts`
- Modify: `src/domain/run.test.ts`

**Interfaces:**
- Consumes: `startFight`, `carryOutDamage`, `FightState`, `FightOutcome` from `./fight`.
- Produces:
  - `startNextFight(run: RunState): RunState` — requires `run.fighter`; throws if null. Builds `FightState` via `startFight({ seed: run.seed, fightNumber: run.fightNumber, playerStatLine: run.fighter.statLine, carryInDamage: run.carriedDamage })`, sets `phase: 'fighting'`, `fight: <that state>`.
  - `settleFight(run: RunState, fightState: FightState): RunState` — reads outcome from `fightState`. On player loss: `record.losses = 1`, keep `fight: fightState`, `phase: 'run-over'`. On player win: `record.wins += 1`; `wasChampion = run.isChampion`; `isChampion = run.isChampion || run.fightNumber === TITLE_FIGHT`; `defenses = wasChampion ? run.defenses + 1 : run.defenses`; `carriedDamage = carryOutDamage(fightState)`; keep `fight: fightState`; `phase: 'reward'`.

> Note: `settleFight` reads `run.fightNumber` BEFORE any increment (the increment happens later in `applyReward`). The belt is won by *winning* fight 5, but `defenses` stays 0 that fight (you weren't champion going in). Fights 6+ won as champion each add 1 defense.

- [ ] **Step 1: Write failing tests**

Use constructed `FightState`-like literals via a small helper so these tests don't depend on live RNG. Only the fields `settleFight` reads must be real; cast the rest.

```ts
import { startRun, applyDraft, startNextFight, settleFight, TITLE_FIGHT, type RunState } from './run';
import type { FightState, FightOutcome } from './fight';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

function readyRun(over: Partial<RunState> = {}): RunState {
  return { ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }), ...over };
}

// A settled FightState with a chosen outcome + carry-out damage.
// carryOutDamage(state) must return `carry` for a player win, so give it what the
// real carryOutDamage reads. If carryOutDamage reads a specific field, set it here.
function settledFight(outcome: FightOutcome, carry: number): FightState {
  return {
    // minimal fields other code won't read in settleFight:
    seed: 'run-42', fightNumber: 1, round: 3, status: 'settled',
    // fields settleFight / carryOutDamage read:
    outcome,
    // damage bookkeeping used by carryOutDamage (player-taken cumulative):
    playerDamage: carry,
  } as unknown as FightState;
}

describe('startNextFight', () => {
  it('starts the ladder fight for the drafted fighter', () => {
    const run = readyRun();
    const next = startNextFight(run);
    expect(next.phase).toBe('fighting');
    expect(next.fight).not.toBeNull();
    expect(next.fight?.fightNumber).toBe(1);
  });

  it('throws when there is no drafted fighter', () => {
    expect(() => startNextFight(startRun('run-42'))).toThrow();
  });
});

describe('settleFight', () => {
  it('records a win and moves to reward (non-title fight)', () => {
    const run = { ...readyRun(), phase: 'fighting' as const };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 3 } as FightOutcome, 0));
    expect(out.phase).toBe('reward');
    expect(out.record).toEqual({ wins: 1, losses: 0 });
    expect(out.isChampion).toBe(false);
    expect(out.defenses).toBe(0);
    expect(out.fight).not.toBeNull();
  });

  it('crowns a champion when winning fight 5 but adds no defense that fight', () => {
    const run = { ...readyRun(), phase: 'fighting' as const, fightNumber: TITLE_FIGHT };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 5 } as FightOutcome, 0));
    expect(out.isChampion).toBe(true);
    expect(out.defenses).toBe(0);
  });

  it('adds a defense when a champion wins fight 6+', () => {
    const run = { ...readyRun(), phase: 'fighting' as const, fightNumber: 6, isChampion: true, defenses: 0 };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 5 } as FightOutcome, 0));
    expect(out.defenses).toBe(1);
  });

  it('ends the run on a loss', () => {
    const run = { ...readyRun(), phase: 'fighting' as const };
    const out = settleFight(run, settledFight({ winner: 'opponent', method: 'KO', round: 2 } as FightOutcome, 0));
    expect(out.phase).toBe('run-over');
    expect(out.record).toEqual({ wins: 0, losses: 1 });
    expect(out.fight).not.toBeNull();
  });
});
```

> If `carryOutDamage` reads different field names than assumed, adjust `settledFight` to populate exactly what the real `carryOutDamage` reads (check `src/domain/fight.ts`). The point of the helper is: for a player win, `carryOutDamage(state)` returns the intended `carry`.

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/domain/run.test.ts`
Expected: FAIL (`startNextFight`/`settleFight` undefined).

- [ ] **Step 3: Implement**

```ts
import { startFight, carryOutDamage, type FightState } from './fight';
// ...existing imports/exports...

export function startNextFight(run: RunState): RunState {
  if (!run.fighter) {
    throw new Error('startNextFight requires a drafted fighter');
  }
  const fight = startFight({
    seed: run.seed,
    fightNumber: run.fightNumber,
    playerStatLine: run.fighter.statLine,
    carryInDamage: run.carriedDamage,
  });
  return { ...run, phase: 'fighting', fight };
}

export function settleFight(run: RunState, fightState: FightState): RunState {
  const outcome = fightState.outcome;
  if (!outcome || outcome.winner !== 'player') {
    return {
      ...run,
      phase: 'run-over',
      record: { ...run.record, losses: 1 },
      fight: fightState,
    };
  }
  const wasChampion = run.isChampion;
  return {
    ...run,
    phase: 'reward',
    record: { ...run.record, wins: run.record.wins + 1 },
    isChampion: wasChampion || run.fightNumber === TITLE_FIGHT,
    defenses: wasChampion ? run.defenses + 1 : run.defenses,
    carriedDamage: carryOutDamage(fightState),
    fight: fightState,
  };
}
```

- [ ] **Step 4: Run — expect GREEN**

Run: `npm test -- src/domain/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/run.ts src/domain/run.test.ts
git commit -m "feat: add startNextFight and settleFight run transitions

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: `run.ts` — reward model (`rewardDelta`, `rerollValue`, `applyReward`) + barrel export

**Files:**
- Modify: `src/domain/run.ts`
- Modify: `src/domain/run.test.ts`
- Modify: `src/domain/index.ts` (add `export * from './run';`)

**Interfaces:**
- Consumes: `createRng` (rng), `rollFighter`, `buildStatLine` (roster), `clampStat`, `StatId`, `StatLine` (stats), `durability` (fight).
- Produces:
  - `type Reward = { type: 'bump'; stat: StatId } | { type: 'reroll'; stat: StatId } | { type: 'recover' }`
  - `interface RewardDelta { reward: Reward; stat: StatId | null; from: number; to: number }`
  - `rerollValue(seed: string, fightNumber: number, stat: StatId): number` — `buildStatLine(rollFighter(createRng(\`${seed}#reward${fightNumber}\`), []))[stat]`.
  - `rewardDelta(run: RunState, reward: Reward): RewardDelta` — pure preview. bump: `from = statLine[stat]`, `to = clampStat(from + BUMP_AMOUNT)`. reroll: `from = statLine[stat]`, `to = rerollValue(seed, fightNumber, stat)`. recover: `stat = null`, `from = carriedDamage`, `to = max(0, from - round(durability(statLine) * RECOVER_FRACTION))`.
  - `applyReward(run: RunState, reward: Reward): RunState` — applies the delta (bump/reroll set `statLine[stat] = to`; recover sets `carriedDamage = to`), then `fightNumber += 1`, `phase: 'pre-fight'`, `fight: null`.

> `rewardDelta` requires `run.fighter`; throw if null (reward only happens after a fight, so a fighter always exists).

- [ ] **Step 1: Write failing tests (exact reward vectors)**

Seed `'run-42'`, `fightNumber: 1`, fighter = PLAYER. From the reference probe:
- reroll `boxing` draw stream `run-42#reward1` ⇒ henry-cejudo ⇒ **boxing 60** (82 → 60, DOWN).
- reroll `fightIQ` ⇒ **86** (78 → 86, UP).
- bump `boxing`: 82 → **90**.
- bump `submissions`: 97 → **99** (clamp).
- `durability(PLAYER) = 94`; heal = `round(94*0.5) = 47`; recover from `carriedDamage 40` ⇒ **0** (`max(0, 40-47)`); from `80` ⇒ **33**.

```ts
import {
  startRun, applyDraft, settleFight, rewardDelta, rerollValue, applyReward,
  type RunState, type Reward,
} from './run';
import { durability } from './fight';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

function rewardReadyRun(over: Partial<RunState> = {}): RunState {
  // a run sitting in 'reward' after winning fight 1 (fighter present, fightNumber 1)
  return {
    ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }),
    phase: 'reward',
    ...over,
  };
}

describe('rerollValue', () => {
  it('draws a fresh fighter from the reward stream and returns the chosen slot', () => {
    expect(rerollValue('run-42', 1, 'boxing')).toBe(60);
    expect(rerollValue('run-42', 1, 'fightIQ')).toBe(86);
  });
});

describe('rewardDelta', () => {
  it('previews a stat bump (+8, clamped at 99)', () => {
    expect(rewardDelta(rewardReadyRun(), { type: 'bump', stat: 'boxing' }))
      .toEqual({ reward: { type: 'bump', stat: 'boxing' }, stat: 'boxing', from: 82, to: 90 });
    expect(rewardDelta(rewardReadyRun(), { type: 'bump', stat: 'submissions' }).to).toBe(99);
  });

  it('previews a gamble re-roll (may go down)', () => {
    expect(rewardDelta(rewardReadyRun(), { type: 'reroll', stat: 'boxing' }))
      .toEqual({ reward: { type: 'reroll', stat: 'boxing' }, stat: 'boxing', from: 82, to: 60 });
  });

  it('previews recover as healing half max durability', () => {
    expect(rewardDelta(rewardReadyRun({ carriedDamage: 40 }), { type: 'recover' }))
      .toEqual({ reward: { type: 'recover' }, stat: null, from: 40, to: 0 });
    expect(rewardDelta(rewardReadyRun({ carriedDamage: 80 }), { type: 'recover' }).to).toBe(33);
  });
});

describe('applyReward', () => {
  it('applies a bump, advances the fight number and returns to pre-fight', () => {
    const out = applyReward(rewardReadyRun(), { type: 'bump', stat: 'boxing' });
    expect(out.fighter?.statLine.boxing).toBe(90);
    expect(out.fightNumber).toBe(2);
    expect(out.phase).toBe('pre-fight');
    expect(out.fight).toBeNull();
  });

  it('applies a re-roll (writes the drawn value)', () => {
    const out = applyReward(rewardReadyRun(), { type: 'reroll', stat: 'boxing' });
    expect(out.fighter?.statLine.boxing).toBe(60);
  });

  it('applies recover to carried damage only', () => {
    const out = applyReward(rewardReadyRun({ carriedDamage: 80 }), { type: 'recover' });
    expect(out.carriedDamage).toBe(33);
    expect(out.fighter?.statLine).toEqual(PLAYER);
  });

  it('bumping Chin raises max durability (emergent, via the engine)', () => {
    const before = rewardReadyRun();
    const after = applyReward(before, { type: 'bump', stat: 'chin' });
    // chin 88 -> 96 => durability round(50+96*0.5)=98 > round(50+88*0.5)=94
    expect(durability(after.fighter!.statLine)).toBeGreaterThan(durability(before.fighter!.statLine));
  });

  it('does not mutate the input run', () => {
    const run = rewardReadyRun();
    applyReward(run, { type: 'bump', stat: 'boxing' });
    expect(run.fighter?.statLine.boxing).toBe(82);
    expect(run.fightNumber).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/domain/run.test.ts`
Expected: FAIL (reward exports undefined).

- [ ] **Step 3: Implement the reward model**

```ts
import { createRng } from './rng';
import { rollFighter, buildStatLine } from './roster';
import { clampStat, type StatId } from './stats';
import { durability } from './fight';
// (keep existing imports)

export type Reward =
  | { type: 'bump'; stat: StatId }
  | { type: 'reroll'; stat: StatId }
  | { type: 'recover' };

export interface RewardDelta {
  reward: Reward;
  stat: StatId | null;
  from: number;
  to: number;
}

export function rerollValue(seed: string, fightNumber: number, stat: StatId): number {
  const rng = createRng(`${seed}#reward${fightNumber}`);
  const fighter = rollFighter(rng, []);
  return buildStatLine(fighter)[stat];
}

export function rewardDelta(run: RunState, reward: Reward): RewardDelta {
  if (!run.fighter) {
    throw new Error('rewardDelta requires a drafted fighter');
  }
  const statLine = run.fighter.statLine;
  if (reward.type === 'bump') {
    const from = statLine[reward.stat];
    return { reward, stat: reward.stat, from, to: clampStat(from + BUMP_AMOUNT) };
  }
  if (reward.type === 'reroll') {
    const from = statLine[reward.stat];
    return { reward, stat: reward.stat, from, to: rerollValue(run.seed, run.fightNumber, reward.stat) };
  }
  const from = run.carriedDamage;
  const heal = Math.round(durability(statLine) * RECOVER_FRACTION);
  return { reward, stat: null, from, to: Math.max(0, from - heal) };
}

export function applyReward(run: RunState, reward: Reward): RunState {
  if (!run.fighter) {
    throw new Error('applyReward requires a drafted fighter');
  }
  const delta = rewardDelta(run, reward);
  let fighter = run.fighter;
  let carriedDamage = run.carriedDamage;
  if (delta.stat) {
    fighter = { ...fighter, statLine: { ...fighter.statLine, [delta.stat]: delta.to } };
  } else {
    carriedDamage = delta.to;
  }
  return {
    ...run,
    fighter,
    carriedDamage,
    fightNumber: run.fightNumber + 1,
    phase: 'pre-fight',
    fight: null,
  };
}
```

- [ ] **Step 4: Add the barrel export**

In `src/domain/index.ts` add:

```ts
export * from './run';
```

- [ ] **Step 5: Run — expect GREEN + typecheck**

Run: `npm test -- src/domain/run.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/domain/run.ts src/domain/run.test.ts src/domain/index.ts
git commit -m "feat: add reward model (bump/reroll/recover) and export run domain

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: FightScreen — make it controlled

**Files:**
- Modify: `src/screens/FightScreen.tsx`
- Modify: `src/screens/FightScreen.test.tsx`

**Interfaces:**
- Consumes: `startFight`, `resolveRound`, `type FightState`, `type Intent` from `../domain`; existing `advanceFight` export stays.
- Produces:
  - `interface FightScreenProps { seed: string; fightNumber: number; fighter: { name: string; statLine: StatLine }; carriedDamage?: number; onSettled: (fight: FightState) => void }`
  - `advanceFight(state: FightState, intent: Intent): FightState` — unchanged export (no-op once settled).
  - The component initializes its local `FightState` from props via `startFight({ seed, fightNumber, playerStatLine: fighter.statLine, carryInDamage: carriedDamage ?? 0 })` and calls `onSettled(next)` on the transition to a terminal state.

**Drop:** `DEMO_FIGHTER`, `DEMO_NAME`, self-managed seed, the "New Fight" button, and the `FightResultPanel` import/usage. When settled, render no action area (the controller swaps the screen). Keep round-by-round intent UI and the `advanceFight` no-op guard.

- [ ] **Step 1: Rewrite the test file for controlled props**

Replace `src/screens/FightScreen.test.tsx` with tests that pass props and assert `onSettled` fires with the settled state. Keep the seeded integration vector (run-42, fight 1, PLAYER, strike×3 ⇒ decision win round 3, opponent "Hideo \"Granite\" Stone", grappler) and the `advanceFight` no-op unit test.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FightScreen, { advanceFight } from './FightScreen';
import { startFight } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
const fighter = { name: 'Kelvin', statLine: PLAYER };

function strike() { fireEvent.click(screen.getByTestId('intent-strike')); }

describe('FightScreen (controlled)', () => {
  it('shows the seeded opponent (grappler challenger) on load', () => {
    render(<FightScreen seed="run-42" fightNumber={1} fighter={fighter} onSettled={() => {}} />);
    expect(screen.getByText(/grappler · challenger/i)).toBeInTheDocument();
  });

  it('calls onSettled once with a decision win in round 3 for the seeded vector', () => {
    const onSettled = vi.fn();
    render(<FightScreen seed="run-42" fightNumber={1} fighter={fighter} onSettled={onSettled} />);
    strike(); strike(); strike();
    expect(onSettled).toHaveBeenCalledTimes(1);
    const settled = onSettled.mock.calls[0][0];
    expect(settled.outcome.winner).toBe('player');
    expect(settled.outcome.method).toBe('decision');
    expect(settled.outcome.round).toBe(3);
  });

  it('advanceFight is a no-op once the fight is settled', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 0 });
    s = advanceFight(s, 'strike');
    s = advanceFight(s, 'strike');
    s = advanceFight(s, 'strike');           // settled here (decision round 3)
    const again = advanceFight(s, 'strike');  // no-op
    expect(again).toBe(s);
  });
});
```

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/screens/FightScreen.test.tsx`
Expected: FAIL (props/shape mismatch; old component still self-seeds and renders New Fight).

- [ ] **Step 3: Rewrite `FightScreen.tsx` as controlled**

Key changes (keep the existing intent panel, health cards, opponent read copy):

```tsx
import { useState } from 'react';
import { startFight, resolveRound, type FightState, type Intent } from '../domain';
import type { StatLine } from '../domain';
// ...existing atom imports (IntentPanel, FighterHealthCard, opponent read copy)...

export interface FightScreenProps {
  seed: string;
  fightNumber: number;
  fighter: { name: string; statLine: StatLine };
  carriedDamage?: number;
  onSettled: (fight: FightState) => void;
}

export function advanceFight(state: FightState, intent: Intent): FightState {
  return state.status === 'in-progress' ? resolveRound(state, intent) : state;
}

export default function FightScreen({ seed, fightNumber, fighter, carriedDamage = 0, onSettled }: FightScreenProps) {
  const [state, setState] = useState<FightState>(() =>
    startFight({ seed, fightNumber, playerStatLine: fighter.statLine, carryInDamage: carriedDamage }),
  );

  function handleIntent(intent: Intent) {
    const next = advanceFight(state, intent);
    setState(next);
    if (state.status === 'in-progress' && next.status !== 'in-progress') {
      onSettled(next);
    }
  }

  const settled = state.status !== 'in-progress';
  return (
    <section data-testid="screen-fight" /* ...existing layout... */>
      {/* health cards, opponent read copy, round indicator — unchanged */}
      {!settled && <IntentPanel /* ...props... */ onIntent={handleIntent} />}
      {/* when settled: render no action area; controller swaps screens */}
    </section>
  );
}
```

> `onSettled` is called from `handleIntent` (an event handler), NOT inside a `setState` updater — this avoids the StrictMode double-fire nit. The `advanceFight` guard means a stray click after settlement returns the same reference and never re-fires `onSettled`.

- [ ] **Step 4: Run — expect GREEN**

Run: `npm test -- src/screens/FightScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify build still compiles (FightResultPanel import now gone)**

Run: `npm run typecheck`
Expected: clean (FightScreen no longer imports FightResultPanel; App still imports it until Task 11 — that's fine, it still exists until Task 7).

> Order matters: Task 6 removes FightScreen's `FightResultPanel` import; Task 7 renames the component. Do Task 6 first so builds stay green.

- [ ] **Step 6: Commit**

```bash
git add src/screens/FightScreen.tsx src/screens/FightScreen.test.tsx
git commit -m "feat: make FightScreen a controlled component driven by run props

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: OutcomeBanner — repurpose FightResultPanel (button removed)

**Files:**
- Create: `src/components/OutcomeBanner.tsx` (from `FightResultPanel.tsx`)
- Create: `src/components/OutcomeBanner.test.tsx` (from the old test, button assertions removed)
- Delete: `src/components/FightResultPanel.tsx`, `src/components/FightResultPanel.test.tsx`

**Interfaces:**
- Consumes: `type FightOutcome` from `../domain`.
- Produces:
  - `interface OutcomeBannerProps { outcome: FightOutcome; heading?: string }`
  - Component with `data-testid="outcome-banner"`, renders "You Win" / "You Lose" from `outcome.winner`, plus method · round. No action button.

- [ ] **Step 1: Create the test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OutcomeBanner from './OutcomeBanner';

describe('OutcomeBanner', () => {
  it('announces a player win with method and round', () => {
    render(<OutcomeBanner outcome={{ winner: 'player', method: 'decision', round: 3 } as any} />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByText(/you win/i)).toBeInTheDocument();
    expect(screen.getByText(/decision/i)).toBeInTheDocument();
    expect(screen.getByText(/round 3/i)).toBeInTheDocument();
  });

  it('announces a player loss', () => {
    render(<OutcomeBanner outcome={{ winner: 'opponent', method: 'KO', round: 2 } as any} />);
    expect(screen.getByText(/you lose/i)).toBeInTheDocument();
  });

  it('renders an optional heading', () => {
    render(<OutcomeBanner heading="Title Defended" outcome={{ winner: 'player', method: 'KO', round: 1 } as any} />);
    expect(screen.getByText(/title defended/i)).toBeInTheDocument();
  });

  it('renders no action button', () => {
    render(<OutcomeBanner outcome={{ winner: 'player', method: 'decision', round: 3 } as any} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/components/OutcomeBanner.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `OutcomeBanner.tsx` from FightResultPanel**

Copy `FightResultPanel.tsx` → `OutcomeBanner.tsx`. Change: rename component to `OutcomeBanner`, testid to `outcome-banner`, props to `{ outcome, heading? }`, **remove the "New Fight"/action button and its `onNewFight` prop**, add the optional `heading`. Keep the "You Win"/"You Lose" + method·round copy and styling.

- [ ] **Step 4: Delete the old panel + its test**

```bash
git rm src/components/FightResultPanel.tsx src/components/FightResultPanel.test.tsx
```

- [ ] **Step 5: Run — expect GREEN + typecheck**

Run: `npm test -- src/components/OutcomeBanner.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean (nothing imports FightResultPanel anymore — Task 6 removed FightScreen's use; App imports it only in the old code path being rewritten in Task 11, so if App still references it, temporarily it will break typecheck — verify App no longer imports it; if App is untouched until Task 11, then App still imports FightResultPanel and typecheck FAILS here).

> **Sequencing guard:** App.tsx must not import `FightResultPanel` at this point. If the merged App references it, either (a) do the App controller rewrite (Task 11) reads `OutcomeBanner`, or (b) leave a thin re-export. Preferred: confirm via `grep -rn FightResultPanel src` returns nothing after Task 7. If App still uses it, pull Task 11's App rewrite forward or add `export { default } from './OutcomeBanner'` shim in a temporary file — but cleanest is: **App in merged main does NOT render FightResultPanel** (M5 wired it only inside FightScreen). Verify with grep before deleting.

- [ ] **Step 6: Verify no dangling references**

Run: `grep -rn "FightResultPanel" src` (or the grep tool)
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add src/components/OutcomeBanner.tsx src/components/OutcomeBanner.test.tsx
git commit -m "refactor: repurpose FightResultPanel into buttonless OutcomeBanner

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: RewardScreen — controlled two-step reward

**Files:**
- Modify: `src/screens/RewardScreen.tsx`
- Modify (or create): `src/screens/RewardScreen.test.tsx`

**Interfaces:**
- Consumes: `type RunState`, `type Reward`, `type StatId`, `STAT_IDS`, `STAT_LABELS`, `rewardDelta` from `../domain`; `OutcomeBanner` from `../components/OutcomeBanner`.
- Produces:
  - `interface RewardScreenProps { run: RunState; onReward: (reward: Reward) => void }`
  - Component with `data-testid="screen-reward"`.

**Behavior:** two-step local `useState` (`step: 'type' | 'target'`, `selectedType`, `selectedStat`).
- Step 1 (`type`): `OutcomeBanner` from `run.fight.outcome`; three buttons `reward-type-bump`, `reward-type-reroll`, `reward-type-recover`. `recover` is disabled when `run.carriedDamage === 0`. Clicking `recover` calls `onReward({ type: 'recover' })` immediately. Clicking bump/reroll → step 2.
- Step 2 (`target`): nine stat buttons `reward-stat-${stat}` (from `STAT_IDS`); a preview line `data-testid="reward-preview"` — bump shows `from → to`; reroll shows `from → ??` (gamble hides the number). A `reward-confirm` button ("Confirm & Continue") calls `onReward({ type: selectedType, stat: selectedStat })`. A `reward-back` button ("← Back to rewards") returns to step 1.

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RewardScreen from './RewardScreen';
import { startRun, applyDraft, type RunState } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

function rewardRun(over: Partial<RunState> = {}): RunState {
  return {
    ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }),
    phase: 'reward',
    fight: { outcome: { winner: 'player', method: 'decision', round: 3 } } as any,
    ...over,
  };
}

describe('RewardScreen', () => {
  it('shows the outcome banner and three reward types', () => {
    render(<RewardScreen run={rewardRun()} onReward={() => {}} />);
    expect(screen.getByTestId('screen-reward')).toBeInTheDocument();
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('reward-type-bump')).toBeInTheDocument();
    expect(screen.getByTestId('reward-type-reroll')).toBeInTheDocument();
    expect(screen.getByTestId('reward-type-recover')).toBeInTheDocument();
  });

  it('disables recover when there is no carried damage', () => {
    render(<RewardScreen run={rewardRun({ carriedDamage: 0 })} onReward={() => {}} />);
    expect(screen.getByTestId('reward-type-recover')).toBeDisabled();
  });

  it('emits recover immediately', () => {
    const onReward = vi.fn();
    render(<RewardScreen run={rewardRun({ carriedDamage: 40 })} onReward={onReward} />);
    fireEvent.click(screen.getByTestId('reward-type-recover'));
    expect(onReward).toHaveBeenCalledWith({ type: 'recover' });
  });

  it('bump: pick type -> stat -> preview shows from -> to, confirm emits', () => {
    const onReward = vi.fn();
    render(<RewardScreen run={rewardRun()} onReward={onReward} />);
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    expect(screen.getByTestId('reward-preview')).toHaveTextContent(/82.*90/);
    fireEvent.click(screen.getByTestId('reward-confirm'));
    expect(onReward).toHaveBeenCalledWith({ type: 'bump', stat: 'boxing' });
  });

  it('reroll: preview hides the drawn value (gamble)', () => {
    render(<RewardScreen run={rewardRun()} onReward={() => {}} />);
    fireEvent.click(screen.getByTestId('reward-type-reroll'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    expect(screen.getByTestId('reward-preview')).toHaveTextContent(/\?\?/);
  });

  it('back returns to the type step', () => {
    render(<RewardScreen run={rewardRun()} onReward={() => {}} />);
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-back'));
    expect(screen.getByTestId('reward-type-bump')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/screens/RewardScreen.test.tsx`
Expected: FAIL (placeholder screen).

- [ ] **Step 3: Implement the controlled two-step screen**

```tsx
import { useState } from 'react';
import {
  STAT_IDS, STAT_LABELS, rewardDelta,
  type RunState, type Reward, type StatId,
} from '../domain';
import OutcomeBanner from '../components/OutcomeBanner';

export interface RewardScreenProps {
  run: RunState;
  onReward: (reward: Reward) => void;
}

type Step = 'type' | 'target';
type PickableType = 'bump' | 'reroll';

export default function RewardScreen({ run, onReward }: RewardScreenProps) {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<PickableType>('bump');
  const [selectedStat, setSelectedStat] = useState<StatId | null>(null);

  const outcome = run.fight?.outcome;

  function chooseType(type: PickableType) {
    setSelectedType(type);
    setSelectedStat(null);
    setStep('target');
  }

  function preview(): string {
    if (!selectedStat) return '';
    const d = rewardDelta(run, { type: selectedType, stat: selectedStat });
    return selectedType === 'reroll' ? `${d.from} → ??` : `${d.from} → ${d.to}`;
  }

  if (step === 'type') {
    return (
      <section data-testid="screen-reward">
        {outcome && <OutcomeBanner outcome={outcome} heading="Victory" />}
        <button data-testid="reward-type-bump" onClick={() => chooseType('bump')}>Bump a stat (+8)</button>
        <button data-testid="reward-type-reroll" onClick={() => chooseType('reroll')}>Re-roll a stat (gamble)</button>
        <button
          data-testid="reward-type-recover"
          disabled={run.carriedDamage === 0}
          onClick={() => onReward({ type: 'recover' })}
        >Recover (heal damage)</button>
      </section>
    );
  }

  return (
    <section data-testid="screen-reward">
      <div>{STAT_IDS.map((s) => (
        <button key={s} data-testid={`reward-stat-${s}`} onClick={() => setSelectedStat(s)}>
          {STAT_LABELS[s]}
        </button>
      ))}</div>
      <p data-testid="reward-preview">{preview()}</p>
      <button
        data-testid="reward-confirm"
        disabled={!selectedStat}
        onClick={() => selectedStat && onReward({ type: selectedType, stat: selectedStat })}
      >Confirm &amp; Continue</button>
      <button data-testid="reward-back" onClick={() => setStep('type')}>← Back to rewards</button>
    </section>
  );
}
```

- [ ] **Step 4: Run — expect GREEN + typecheck**

Run: `npm test -- src/screens/RewardScreen.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/RewardScreen.tsx src/screens/RewardScreen.test.tsx
git commit -m "feat: controlled two-step reward screen (bump/reroll/recover)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: ChampionshipHubScreen — controlled hub (landing / climb / title / champion / run-over)

**Files:**
- Modify: `src/screens/ChampionshipHubScreen.tsx`
- Modify (or create): `src/screens/ChampionshipHubScreen.test.tsx`

**Interfaces:**
- Consumes: `type RunState`, `generateOpponent`, `STAT_IDS`, `STAT_LABELS`, `TITLE_FIGHT` from `../domain`; `FighterHealthCard`, `StatBar` from `../components`; `OutcomeBanner` from `../components/OutcomeBanner`.
- Produces:
  - `interface HubProps { run: RunState | null; onStartRun: () => void; onEnterFight: () => void }`
  - Component with `data-testid="screen-championship-hub"`.

**States:**
- `run === null` → landing: title + "Start New Run" button (`data-testid="start-run"`, calls `onStartRun`).
- `run.phase === 'pre-fight'` and `fightNumber` 1–4 → climb: `FighterHealthCard` + a 9-stat `StatBar` grid (from `run.fighter.statLine`) + next-opponent card `data-testid="next-opponent"` from `generateOpponent(run.seed, run.fightNumber)` + "Enter the Octagon" button (`data-testid="enter-fight"`, calls `onEnterFight`).
- `run.phase === 'pre-fight'` and `fightNumber === 5` → title bout: heading "For the Vacant Belt" + button "Fight for the Belt" (same `enter-fight` testid).
- `run.phase === 'pre-fight'` and `fightNumber >= 6` (`run.isChampion`) → champion: heading `Champion · Reign ${run.defenses}` + button "Defend the Belt".
- `run.phase === 'run-over'` → OutcomeBanner (from `run.fight.outcome`) + final reign/record + "Start New Run" button (`start-run`).

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChampionshipHubScreen from './ChampionshipHubScreen';
import { startRun, applyDraft, type RunState } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
function preFight(over: Partial<RunState> = {}): RunState {
  return { ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }), ...over };
}

describe('ChampionshipHubScreen', () => {
  it('landing: shows Start New Run when there is no run', () => {
    const onStartRun = vi.fn();
    render(<ChampionshipHubScreen run={null} onStartRun={onStartRun} onEnterFight={() => {}} />);
    fireEvent.click(screen.getByTestId('start-run'));
    expect(onStartRun).toHaveBeenCalled();
  });

  it('climb: shows the next opponent and enters the fight', () => {
    const onEnterFight = vi.fn();
    render(<ChampionshipHubScreen run={preFight({ fightNumber: 1 })} onStartRun={() => {}} onEnterFight={onEnterFight} />);
    expect(screen.getByTestId('next-opponent')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enter-fight'));
    expect(onEnterFight).toHaveBeenCalled();
  });

  it('title bout: reads For the Vacant Belt at fight 5', () => {
    render(<ChampionshipHubScreen run={preFight({ fightNumber: 5 })} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByText(/vacant belt/i)).toBeInTheDocument();
  });

  it('champion: shows reign count at fight 6+', () => {
    render(<ChampionshipHubScreen run={preFight({ fightNumber: 6, isChampion: true, defenses: 2 })} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByText(/reign 2/i)).toBeInTheDocument();
  });

  it('run-over: shows the outcome banner and Start New Run', () => {
    const run = preFight({
      phase: 'run-over',
      record: { wins: 3, losses: 1 },
      fight: { outcome: { winner: 'opponent', method: 'KO', round: 2 } } as any,
    });
    render(<ChampionshipHubScreen run={run} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/screens/ChampionshipHubScreen.test.tsx`
Expected: FAIL (placeholder).

- [ ] **Step 3: Implement**

```tsx
import {
  generateOpponent, STAT_IDS, STAT_LABELS, TITLE_FIGHT,
  type RunState,
} from '../domain';
import FighterHealthCard from '../components/FighterHealthCard';
import StatBar from '../components/StatBar';
import OutcomeBanner from '../components/OutcomeBanner';

export interface HubProps {
  run: RunState | null;
  onStartRun: () => void;
  onEnterFight: () => void;
}

export default function ChampionshipHubScreen({ run, onStartRun, onEnterFight }: HubProps) {
  if (run === null) {
    return (
      <section data-testid="screen-championship-hub">
        <h1>Title Run</h1>
        <button data-testid="start-run" onClick={onStartRun}>Start New Run</button>
      </section>
    );
  }

  if (run.phase === 'run-over') {
    return (
      <section data-testid="screen-championship-hub">
        {run.fight?.outcome && <OutcomeBanner outcome={run.fight.outcome} heading="Run Ended" />}
        <p>Record {run.record.wins}–{run.record.losses}</p>
        {run.isChampion && <p>Reign {run.defenses}</p>}
        <button data-testid="start-run" onClick={onStartRun}>Start New Run</button>
      </section>
    );
  }

  // pre-fight
  const fighter = run.fighter;
  const isTitle = run.fightNumber === TITLE_FIGHT;
  const isChampion = run.isChampion;
  const opponent = generateOpponent(run.seed, run.fightNumber);

  return (
    <section data-testid="screen-championship-hub">
      {isChampion ? (
        <h2>Champion · Reign {run.defenses}</h2>
      ) : isTitle ? (
        <h2>For the Vacant Belt</h2>
      ) : (
        <h2>Fight {run.fightNumber}</h2>
      )}

      {fighter && (
        <>
          <FighterHealthCard name={fighter.name} statLine={fighter.statLine} carriedDamage={run.carriedDamage} />
          <div>
            {STAT_IDS.map((s) => (
              <StatBar key={s} value={fighter.statLine[s]} label={STAT_LABELS[s]} />
            ))}
          </div>
        </>
      )}

      <div data-testid="next-opponent">
        <p>{opponent.name}</p>
        <p>{opponent.style}</p>
      </div>

      <button data-testid="enter-fight" onClick={onEnterFight}>
        {isChampion ? 'Defend the Belt' : isTitle ? 'Fight for the Belt' : 'Enter the Octagon'}
      </button>
    </section>
  );
}
```

> Match `FighterHealthCard`'s real prop names — check the merged component. If it takes `damage` rather than `carriedDamage`, adapt. The test only asserts opponent + buttons + headings, so prop-name drift won't break tests, but typecheck will — keep it clean.

- [ ] **Step 4: Run — expect GREEN + typecheck**

Run: `npm test -- src/screens/ChampionshipHubScreen.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ChampionshipHubScreen.tsx src/screens/ChampionshipHubScreen.test.tsx
git commit -m "feat: controlled championship hub (landing/climb/title/champion/run-over)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 10: DraftScreen — fold carryover nits + `onComplete` seam test

**Files:**
- Modify: `src/screens/DraftScreen.tsx`
- Modify: `src/screens/DraftScreen.test.tsx`

**Interfaces:**
- Consumes: existing draft domain + `onComplete?: (drafted: DraftedFighter) => void` prop (seam reserved in M3).
- Produces: no new public API; behavior fixes only. Keeps `data-testid="screen-draft"`.

**Three nits (from M3 review) + one seam test:**
1. `handleName`: compute the drafted fighter and call `onComplete?.(drafted)` OUTSIDE the `setState` updater (StrictMode double-fire fix).
2. Complete view: hoist `getDraftedFighter(state)` out of the `STAT_IDS.map` loop (call once).
3. `handleRestart`: "New Draft" reuses `seed` prop when present: `startDraft(seed ?? String(Date.now()))`.
Plus: add a test asserting `onComplete` fires exactly once with the drafted fighter when the last stat is kept and the name is confirmed.

- [ ] **Step 1: Write the failing `onComplete` seam test**

```tsx
it('calls onComplete once with the drafted fighter after naming', () => {
  const onComplete = vi.fn();
  render(<DraftScreen seed="run-42" onComplete={onComplete} />);
  // keep the suggested stat 9 times
  for (let i = 0; i < 9; i++) {
    fireEvent.click(screen.getByTestId('suggested-stat'));
  }
  fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
  fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete.mock.calls[0][0]).toMatchObject({ name: 'Kelvin' });
});
```

> Selectors verified for M3: the suggested-stat button carries `data-testid="suggested-stat"`; the name input has `aria-label="Fighter name"`; submit button text is "Confirm Fighter". If StrictMode double-invokes and the count is 2, that's exactly the bug this task fixes — the fix in Step 3 makes it 1.

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/screens/DraftScreen.test.tsx`
Expected: FAIL (either `onComplete` fires twice under StrictMode, or not with the right payload).

- [ ] **Step 3: Apply the three fixes**

In `DraftScreen.tsx`:

```tsx
// (1) handleName — side-effect OUT of the updater:
function handleName(name: string) {
  const named = nameFighter(state, name);
  setState(named);
  if (named.status === 'complete') {
    onComplete?.(getDraftedFighter(named));
  }
}

// (2) complete view — hoist once:
// before: STAT_IDS.map(s => ... getDraftedFighter(state)[...] ...)
const drafted = getDraftedFighter(state);
// ...then use `drafted` inside the map.

// (3) handleRestart — reuse seed prop:
function handleRestart() {
  setState(startDraft(seed ?? String(Date.now())));
}
```

- [ ] **Step 4: Run — expect GREEN (all draft tests)**

Run: `npm test -- src/screens/DraftScreen.test.tsx`
Expected: PASS (seam test + all existing draft tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/screens/DraftScreen.tsx src/screens/DraftScreen.test.tsx
git commit -m "fix: hoist drafted fighter, move onComplete out of updater, reuse run seed

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 11: TopAppBar status + App controller + delete nav (one-loop UI integration)

**Files:**
- Modify: `src/components/TopAppBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Delete: `src/components/BottomNavBar.tsx` (+ test if present), `src/navigation/screens.ts`, `src/navigation/screens.test.ts`

**Interfaces:**
- TopAppBar Produces:
  - `runStatusLabel(run: RunState | null): string` — `null`→`''`; `drafting`→`'Drafting'`; `run-over`→`'Run Ended'`; `isChampion`→`★ Champion · Reign ${defenses}`; else→`Fight ${fightNumber} · ${wins}–${losses} · Challenger` (en-dash `–` in the record).
  - `interface TopAppBarProps { run: RunState | null }` (plus any existing props).
- App Produces: `App({ makeSeed = () => String(Date.now()) }: { makeSeed?: () => string })` — thin controller.

**App rendering rule:**
- `run === null` OR `run.phase === 'pre-fight'` OR `run.phase === 'run-over'` → `ChampionshipHubScreen`.
- `run.phase === 'drafting'` → `DraftScreen` (`seed={run.seed}`, `onComplete={handleDraftComplete}`).
- `run.phase === 'fighting'` → `FightScreen` (guard `run.fighter`; pass seed/fightNumber/fighter/carriedDamage/onSettled).
- `run.phase === 'reward'` → `RewardScreen` (`run`, `onReward`).

**Handlers (all via `setRun`):**
- `handleStartRun` → `setRun(startRun(makeSeed()))`.
- `handleDraftComplete(d)` → `setRun((r) => applyDraft(r!, d))`.
- `handleEnterFight` → `setRun((r) => startNextFight(r!))`.
- `handleSettled(fight)` → `setRun((r) => settleFight(r!, fight))`.
- `handleReward(reward)` → `setRun((r) => applyReward(r!, reward))`.

**Delete:** BottomNavBar (no more tab nav — the run phase drives screens) and the `navigation/screens` registry.

- [ ] **Step 1: Write failing `runStatusLabel` unit tests**

Add to `src/components/TopAppBar.test.tsx` (create if absent):

```tsx
import { describe, it, expect } from 'vitest';
import { runStatusLabel } from './TopAppBar';
import { startRun, applyDraft, type RunState } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
const base = (o: Partial<RunState> = {}): RunState => ({ ...applyDraft(startRun('run-42'), { name: 'K', statLine: PLAYER }), ...o });

describe('runStatusLabel', () => {
  it('is empty with no run', () => { expect(runStatusLabel(null)).toBe(''); });
  it('reads Drafting during the draft', () => { expect(runStatusLabel(base({ phase: 'drafting' }))).toBe('Drafting'); });
  it('reads Run Ended after a loss', () => { expect(runStatusLabel(base({ phase: 'run-over' }))).toBe('Run Ended'); });
  it('shows the challenger record while climbing', () => {
    expect(runStatusLabel(base({ phase: 'pre-fight', fightNumber: 2, record: { wins: 1, losses: 0 } })))
      .toBe('Fight 2 · 1–0 · Challenger');
  });
  it('shows the reign as champion', () => {
    expect(runStatusLabel(base({ phase: 'pre-fight', fightNumber: 6, isChampion: true, defenses: 3 })))
      .toBe('★ Champion · Reign 3');
  });
});
```

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- src/components/TopAppBar.test.tsx`
Expected: FAIL (`runStatusLabel` undefined).

- [ ] **Step 3: Implement `runStatusLabel` + TopAppBar prop**

```tsx
import type { RunState } from '../domain';

export function runStatusLabel(run: RunState | null): string {
  if (!run) return '';
  if (run.phase === 'drafting') return 'Drafting';
  if (run.phase === 'run-over') return 'Run Ended';
  if (run.isChampion) return `★ Champion · Reign ${run.defenses}`;
  return `Fight ${run.fightNumber} · ${run.record.wins}–${run.record.losses} · Challenger`;
}

export interface TopAppBarProps { run: RunState | null }

export default function TopAppBar({ run }: TopAppBarProps) {
  return (
    <header /* ...existing brand/layout... */>
      {/* existing title */}
      <span data-testid="run-status">{runStatusLabel(run)}</span>
    </header>
  );
}
```

- [ ] **Step 4: Run — expect GREEN**

Run: `npm test -- src/components/TopAppBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing App integration test**

Rewrite `src/App.test.tsx` to drive one full loop deterministically with `makeSeed={() => 'run-42'}`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App run loop', () => {
  it('landing → draft → pre-fight → fight → reward → next fight', () => {
    render(<App makeSeed={() => 'run-42'} />);

    // landing
    fireEvent.click(screen.getByTestId('start-run'));

    // draft: keep suggested 9x, then name
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByTestId('suggested-stat'));
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));

    // pre-fight hub → enter octagon
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enter-fight'));

    // fight: strike x3 => decision win round 3 (seeded run-42 fight 1)
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));

    // reward: bump boxing, confirm
    expect(screen.getByTestId('screen-reward')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    fireEvent.click(screen.getByTestId('reward-confirm'));

    // back at the hub, now fight 2
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 2/i);
  });
});
```

- [ ] **Step 6: Run — expect RED**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL on the first `getByTestId('start-run')` — App is still the M5 tab shell and renders no hub landing. (App still compiles here; nav files are deleted in Step 8 after the rewrite.)

- [ ] **Step 7: Rewrite `App.tsx` as the controller**

```tsx
import { useState } from 'react';
import {
  startRun, applyDraft, startNextFight, settleFight, applyReward,
  type RunState, type Reward, type FightState,
} from './domain';
import type { DraftedFighter } from './domain';
import TopAppBar from './components/TopAppBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightScreen from './screens/FightScreen';
import RewardScreen from './screens/RewardScreen';

export interface AppProps {
  makeSeed?: () => string;
}

export default function App({ makeSeed = () => String(Date.now()) }: AppProps) {
  const [run, setRun] = useState<RunState | null>(null);

  const handleStartRun = () => setRun(startRun(makeSeed()));
  const handleDraftComplete = (d: DraftedFighter) =>
    setRun((r) => (r ? applyDraft(r, d) : r));
  const handleEnterFight = () => setRun((r) => (r ? startNextFight(r) : r));
  const handleSettled = (fight: FightState) =>
    setRun((r) => (r ? settleFight(r, fight) : r));
  const handleReward = (reward: Reward) =>
    setRun((r) => (r ? applyReward(r, reward) : r));

  function screen() {
    if (run === null || run.phase === 'pre-fight' || run.phase === 'run-over') {
      return (
        <ChampionshipHubScreen
          run={run}
          onStartRun={handleStartRun}
          onEnterFight={handleEnterFight}
        />
      );
    }
    if (run.phase === 'drafting') {
      return <DraftScreen seed={run.seed} onComplete={handleDraftComplete} />;
    }
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
    // reward
    return <RewardScreen run={run} onReward={handleReward} />;
  }

  return (
    <div /* existing app shell classes */>
      <TopAppBar run={run} />
      <main>{screen()}</main>
    </div>
  );
}
```

- [ ] **Step 8: Delete the dev tab nav (now unreferenced)**

```bash
git rm src/components/BottomNavBar.tsx src/navigation/screens.ts src/navigation/screens.test.ts
# also remove src/components/BottomNavBar.test.tsx if it exists
```

- [ ] **Step 9: Run — expect GREEN**

Run: `npm test -- src/App.test.tsx`
Expected: PASS (full loop landing→fight2).

- [ ] **Step 10: Full gate**

Run: `npm test`
Expected: whole suite PASS.
Run: `npm run typecheck`
Expected: clean.
Run: `npm run build`
Expected: succeeds.
Run: `grep -rn "BottomNavBar\|navigation/screens" src`
Expected: no matches.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: run-driven App controller and TopAppBar status; remove tab nav

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 12: Full-run DOMAIN integration test (real engine, champion@5 + loss@6)

**Files:**
- Modify: `src/domain/run.test.ts` (add one integration test using the REAL engine)

**Why:** Tasks 3–5 test the state machine with constructed `FightState` literals. This task proves the whole run threads through the *real* `startFight`/`resolveRound`/`settleFight`/`applyReward` chain deterministically.

**Interfaces:**
- Consumes: `startRun`, `applyDraft`, `startNextFight`, `settleFight`, `applyReward`, plus `resolveRound` from `../domain`.

**Deterministic vector (seed `'run-42'`, fighter = PLAYER, strike every round, recover-only rewards so stats never change):**
- f1 win decision r3; f2 win decision r3; f3 win decision r3; f4 win decision r3; f5 win decision r5 → **champion, defenses 0**; f6 **LOSS** decision r5 → **run-over**. `carriedDamage` stays 0 through f5 (so `recover` is a genuine no-op each time and stats stay = PLAYER).

- [ ] **Step 1: Write the failing integration test**

```ts
import { resolveRound } from '../domain';

function playFight(run: RunState): RunState {
  let started = startNextFight(run);
  let fs = started.fight!;
  while (fs.status === 'in-progress') {
    fs = resolveRound(fs, 'strike');
  }
  return settleFight(started, fs);
}

it('plays a full deterministic run: champion at fight 5, loss at fight 6', () => {
  let run = applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER });

  // fights 1..5 — all wins, reward = recover (no-op at 0 damage)
  for (let i = 0; i < 5; i++) {
    run = playFight(run);
    expect(run.phase).toBe('reward');
    run = applyReward(run, { type: 'recover' });
    expect(run.phase).toBe('pre-fight');
  }
  expect(run.isChampion).toBe(true);
  expect(run.defenses).toBe(0);
  expect(run.record).toEqual({ wins: 5, losses: 0 });
  expect(run.fightNumber).toBe(6);

  // fight 6 — loss ends the run
  run = playFight(run);
  expect(run.phase).toBe('run-over');
  expect(run.record).toEqual({ wins: 5, losses: 1 });
  expect(run.fight?.outcome?.winner).toBe('opponent');
});
```

> `run.fighter.statLine` stays exactly PLAYER because every reward is `recover` at 0 carried damage (heal has nothing to remove). If the real engine yields any carried damage after a win, `recover` still won't change stats — the assertion set above doesn't pin stat values, only phases/record/champion, so it's robust to carry drift while still proving the ladder + belt + permadeath.

- [ ] **Step 2: Run — expect it to PASS immediately (engine already built)**

Run: `npm test -- src/domain/run.test.ts`
Expected: PASS. If it FAILS, the failure encodes a real determinism drift — STOP and report the exact fight/round/outcome that differs from the vector (champion@5, loss@6) rather than editing the vector to match.

> This is the one place a "test that passes on first write" is correct: it's an end-to-end determinism lock over already-implemented code, not a TDD RED/GREEN pair. Treat an unexpected pass on a *new behavior* elsewhere as a red flag; here a pass is the goal.

- [ ] **Step 3: Full gate**

Run: `npm test`
Expected: whole suite PASS.
Run: `npm run typecheck && npm run build`
Expected: clean + build ok.

- [ ] **Step 4: Commit**

```bash
git add src/domain/run.test.ts
git commit -m "test: full deterministic run integration (champion at 5, loss at 6)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Self-review checklist (run before opening the PR)

- [ ] `grep -rn "FightResultPanel\|BottomNavBar\|navigation/screens" src` → no matches.
- [ ] `grep -rn "Math.random" src` → no matches.
- [ ] `git diff origin/main --stat` shows `src/domain/opponent.ts`, `src/domain/stats.ts`, `src/domain/rng.ts`, `src/domain/roster.ts`, `src/domain/draft.ts`, `src/domain/archetypes.ts` UNCHANGED. Only `fight.ts` (one line), `index.ts` (one export), and the new `run.ts` change in domain.
- [ ] `package.json` deps unchanged (react, react-dom only); no new devDeps.
- [ ] Every commit message ends with the Copilot App trailer.
- [ ] `npm test` (all pass), `npm run typecheck` (clean), `npm run build` (ok).
- [ ] Names consistent across tasks: `RunState`, `RunPhase`, `RunFighter`, `startRun`, `applyDraft`, `startNextFight`, `settleFight`, `rewardDelta`, `rerollValue`, `applyReward`, `runStatusLabel`, `advanceFight`, `OutcomeBanner`.
- [ ] Screens keep stable testids: `screen-championship-hub`, `screen-draft`, `screen-fight`, `screen-reward`, `outcome-banner`, `run-status`, `next-opponent`, `enter-fight`, `start-run`, `reward-type-*`, `reward-stat-*`, `reward-preview`, `reward-confirm`, `reward-back`, `intent-strike`, `suggested-stat`.

## PR checklist

- Branch off `origin/main` @ `184a827`; open PR into `main`; **do not merge**.
- PR body: summarize the run machine, the one-line engine change + the 2 re-baked vectors, screen conversions, deletions, and the full-run determinism lock. Note no new deps, engine/opponent otherwise untouched.
- Wait for CI `build-and-test` green, then hand back to the orchestrator for the GPT-5.5 xhigh review → Copilot review → user merge.
