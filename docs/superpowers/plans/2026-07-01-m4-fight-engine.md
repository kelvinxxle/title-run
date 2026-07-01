# M4 Fight Engine Implementation Plan

**Goal:** Build the pure, deterministic **fight engine** for Title Run — generate a scaling opponent per fight, resolve a bout round-by-round from a tactical intent, apply damage against a Chin-driven durability threshold, and settle by KO / submission / decision.

**Architecture:** Two new pure domain modules — `src/domain/opponent.ts` (opponent generation + difficulty scaling) and `src/domain/fight.ts` (fight state machine: intents, round resolution, finishes, decision). Both are seeded and side-effect-free, built entirely on the existing M2 domain (`rng`, `stats`, `archetypes`). No React, no DOM, no `Math.random`, no `localStorage`, no new dependencies. Fight state is a plain serializable object so M7 can autosave/resume it. The player's drafted `StatLine` is passed **into** `startFight`; M4 does not own run/streak state (that is M6).

**Tech Stack:** TypeScript (strict), Vitest. Domain layer only.

## Global Constraints
- **TypeScript strict** — no `any`, no non-null-assertion abuse; all exports fully typed.
- **Determinism** — identical inputs MUST produce byte-identical output. All randomness comes from `createRng(seed)` (M2, xmur3→mulberry32). Derive per-purpose streams with string-suffixed seeds: opponent uses `` `${seed}#opp${fightNumber}` ``; each round uses `` `${seed}#r${round}` ``. Never store a live RNG closure in state; re-derive from the seed each call.
- **Pure domain only** — files created/modified live under `src/domain/` (plus their `.test.ts`).
- **No new dependencies**, no changes to `package.json`.
- **Integer math for stable assertions** — every value that lands in state or a result (`dominance`, damage, ratings, durability) is passed through `Math.round`/`Math.min`/`Math.max` to an integer.
- **Reuse M2, do not reimplement it** — import `createRng`, `pick`, `STAT_IDS`, `StatId`, `StatLine`, `clampStat`, `ARCHETYPES`, `ARCHETYPE_IDS`, `Archetype`.
- **Commit trailer** on every commit body: `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`. Commit **subjects** verbatim.
- **Per task, strict TDD:** RED → confirm fail → minimal impl → GREEN → typecheck → build → commit. Never weaken a determinism assertion; if a number differs, STOP and report.

## Design reference (locked)
**Combat model:** each round the player commits one tactical intent. The intent selects an offense stat pair (player) and a defense stat pair (opponent). `dominance` = (player offense avg − opponent defense avg) + Fight-IQ tilt + a seeded round roll. Positive → player wins the round and deals damage; negative → opponent wins and deals damage.
**Feel — measured:** damage accumulates. A finish fires only when total damage crosses the loser's durability threshold (Chin-driven). Single-round damage is hard-capped (`MAX_ROUND_DAMAGE = 32`) strictly below the minimum durability (`50 + 1×0.5 = 51`), so you can never be finished in one round from full health.
**Difficulty:** fights 1–4 climb gently (+4/fight); fight 5 is the title fight (switches to 5 rounds); fights 5+ escalate faster (+5/fight).

**Intent → stat table (LOCKED):**
- `strike`: offense [boxing, kicks], defense [chin, fightIQ], finish `KO`
- `clinch`: offense [clinch, cardio], defense [clinch, chin], finish `KO`
- `takedown`: offense [takedowns, topControl], defense [takedowns, fightIQ], finish `null` (control only)
- `submit`: offense [submissions, topControl], defense [submissions, chin], finish `submission`
- `outpoint`: offense [fightIQ, cardio], defense [fightIQ, cardio], finish `null` (points only)

Only `strike`, `clinch`, `submit` can finish. When the opponent finishes the player, the method comes from the opponent's style (`STYLE_FINISH`).

**Constants (LOCKED):** `IQ_FACTOR = 0.1`, `ROLL_RANGE = 30`, `DMG_FACTOR = 0.6`, `DURA_BASE = 50`, `CHIN_FACTOR = 0.5`, `MAX_ROUND_DAMAGE = 32`.

**Product decisions (do not deviate):** round-win ties go to the player (`dominance >= 0` ⇒ player); decision ties go to the player (`playerRoundsWon >= opponentRoundsWon` ⇒ player); opponents use generated flavor names (name pools fixed, part of the vectors); player stat line is an input.

## Files
- Create: `src/domain/opponent.ts`, `src/domain/opponent.test.ts`
- Create: `src/domain/fight.ts`, `src/domain/fight.test.ts`
- Modify: `src/domain/rng.ts`, `src/domain/rng.test.ts` (harden `randInt`)
- Modify: `src/domain/stats.ts`, `src/domain/stats.test.ts` (`isStatId(unknown)`)
- Modify: `src/domain/index.ts` (export `./opponent` and `./fight`); append to existing `src/domain/index.test.ts`.

### Interfaces produced by M4
```ts
// opponent.ts
export interface Opponent { id: string; name: string; style: Archetype; statLine: StatLine; }
export function targetRating(fightNumber: number): number;
export function generateOpponent(seed: string, fightNumber: number): Opponent;
// fight.ts
export type Intent = 'strike' | 'clinch' | 'takedown' | 'submit' | 'outpoint';
export type FinishMethod = 'KO' | 'submission' | 'decision';
export type Side = 'player' | 'opponent';
export interface RoundResult { round: number; intent: Intent; dominance: number; roundWinner: Side; playerDamage: number; opponentDamage: number; }
export interface FightOutcome { method: FinishMethod; round: number; winner: Side; }
export type FightStatus = 'in-progress' | 'won' | 'lost';
export interface FightState { seed: string; fightNumber: number; rounds: number; round: number; player: { statLine: StatLine; damage: number }; opponent: Opponent & { damage: number }; history: RoundResult[]; status: FightStatus; outcome: FightOutcome | null; }
export interface StartFightArgs { seed: string; fightNumber: number; playerStatLine: StatLine; carryInDamage?: number; }
export function roundsForFight(fightNumber: number): number;
export function durability(statLine: StatLine): number;
export function startFight(args: StartFightArgs): FightState;
export function resolveRound(state: FightState, intent: Intent): FightState;
export function carryOutDamage(state: FightState): number;
```

---

### Task 0: Commit the plan document
- Create `docs/superpowers/plans/2026-07-01-m4-fight-engine.md` containing the full text of this plan (verbatim).
- Commit: `git add docs/superpowers/plans/2026-07-01-m4-fight-engine.md && git commit -m "docs: add M4 fight engine implementation plan"`

### Task 1: Harden `randInt` and `isStatId` (M2 review nits)
**Step 1 — failing tests.** Append to `src/domain/rng.test.ts` (reuse existing `createRng`/`randInt` import if already present):
```ts
import { describe, it, expect } from 'vitest';
import { createRng, randInt } from './rng';

describe('randInt validation', () => {
  it('throws when max < min', () => {
    const rng = createRng('x');
    expect(() => randInt(rng, 5, 1)).toThrow(/max must be >= min/);
  });
  it('throws when a bound is not finite', () => {
    const rng = createRng('x');
    expect(() => randInt(rng, 0, Infinity)).toThrow(/finite/);
    expect(() => randInt(rng, NaN, 3)).toThrow(/finite/);
  });
  it('still returns an in-range integer for valid bounds', () => {
    const rng = createRng('seed');
    for (let i = 0; i < 50; i++) {
      const v = randInt(rng, 2, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});
```
**Step 2 — run, confirm fail:** `npm run test -- src/domain/rng.test.ts`.
**Step 3 — implement.** In `src/domain/rng.ts` replace `randInt`:
```ts
export function randInt(rng: Rng, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('randInt: min and max must be finite numbers');
  }
  if (max < min) {
    throw new Error('randInt: max must be >= min');
  }
  return min + Math.floor(rng() * (max - min + 1));
}
```
**Step 4 — run, confirm green:** `npm run test -- src/domain/rng.test.ts`.
**Step 5 — failing tests.** Append to `src/domain/stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isStatId } from './stats';

describe('isStatId accepts unknown', () => {
  it('returns true for a valid stat id', () => { expect(isStatId('boxing')).toBe(true); });
  it('returns false for a non-matching string', () => { expect(isStatId('nope')).toBe(false); });
  it('returns false for non-string values', () => {
    expect(isStatId(123 as unknown)).toBe(false);
    expect(isStatId(null as unknown)).toBe(false);
    expect(isStatId(undefined as unknown)).toBe(false);
    expect(isStatId({} as unknown)).toBe(false);
  });
});
```
**Step 6 — run, confirm fail:** `npm run test -- src/domain/stats.test.ts`.
**Step 7 — implement.** In `src/domain/stats.ts` replace `isStatId`:
```ts
export function isStatId(value: unknown): value is StatId {
  return typeof value === 'string' && (STAT_IDS as readonly string[]).includes(value);
}
```
**Step 8 — verify:** `npm run test -- src/domain/stats.test.ts` → PASS; `npm run typecheck`; `npm run build`.
**Step 9 — commit:**
```bash
git add src/domain/rng.ts src/domain/rng.test.ts src/domain/stats.ts src/domain/stats.test.ts
git commit -m "fix: harden randInt and isStatId (M2 review nits)"
```

### Task 2: Opponent generation + difficulty scaling (`opponent.ts`)
Determinism: `generateOpponent` draws from `createRng(`${seed}#opp${fightNumber}`)` in pick order **style → first → nick → last**. Stats = archetype baseline shifted by `delta = targetRating(fightNumber) − archetypeBaselineAvg`, then `clampStat` per stat. `id = `opp-${fightNumber}``.
**Step 1 — failing test.** Create `src/domain/opponent.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { STAT_IDS } from './stats';
import { ARCHETYPE_IDS } from './archetypes';
import { targetRating, generateOpponent } from './opponent';

const avg = (sl: Record<string, number>) =>
  Math.round(STAT_IDS.reduce((s, k) => s + sl[k], 0) / STAT_IDS.length);

describe('targetRating', () => {
  it('climbs gently for fights 1-4 then escalates from the title fight', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(targetRating)).toEqual([58, 62, 66, 70, 74, 79, 84, 89]);
  });
});

describe('generateOpponent', () => {
  it('is fully deterministic for a fixed seed + fight number', () => {
    expect(generateOpponent('run-42', 1)).toEqual(generateOpponent('run-42', 1));
  });
  it('produces the exact scouted opponent for seed "run-42", fight 1', () => {
    expect(generateOpponent('run-42', 1)).toEqual({
      id: 'opp-1',
      name: 'Hideo "Granite" Stone',
      style: 'grappler',
      statLine: { boxing: 44, kicks: 42, clinch: 58, takedowns: 66, submissions: 74, topControl: 72, cardio: 56, chin: 52, fightIQ: 62 },
    });
  });
  it('scales the average rating to targetRating and uses a real archetype style', () => {
    for (const n of [1, 2, 3, 5, 6]) {
      const o = generateOpponent('run-42', n);
      expect(o.id).toBe(`opp-${n}`);
      expect(ARCHETYPE_IDS).toContain(o.style);
      expect(avg(o.statLine)).toBe(targetRating(n));
    }
  });
  it('gives different fights distinct opponents under the same run seed', () => {
    const f1 = generateOpponent('run-42', 1);
    const f2 = generateOpponent('run-42', 2);
    expect(f2.id).not.toBe(f1.id);
    expect(f2.name).not.toBe(f1.name);
  });
});
```
**Step 2 — run, confirm fail:** `npm run test -- src/domain/opponent.test.ts`.
**Step 3 — implement.** Create `src/domain/opponent.ts`:
```ts
import { STAT_IDS, clampStat } from './stats';
import type { StatLine } from './stats';
import { createRng, pick } from './rng';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import type { Archetype } from './archetypes';

export interface Opponent {
  id: string;
  name: string;
  style: Archetype;
  statLine: StatLine;
}

const FIRST = ['Rex', 'Dmitri', 'Kano', 'Bruno', 'Silas', 'Tariq', 'Lars', 'Hideo', 'Marcus', 'Diego', 'Yuri', 'Cole'] as const;
const NICK = ['The Hammer', 'Ironjaw', 'Nightmare', 'The Surgeon', 'Cyclone', 'Granite', 'The Wolf', 'Bad News'] as const;
const LAST = ['Stone', 'Vega', 'Kruger', 'Mercer', 'Okafor', 'Novak', 'Rivas', 'Falk', 'Draco', 'Voss', 'Ito', 'Bane'] as const;

export function targetRating(fightNumber: number): number {
  return fightNumber <= 4 ? 54 + fightNumber * 4 : 74 + (fightNumber - 5) * 5;
}

export function generateOpponent(seed: string, fightNumber: number): Opponent {
  const rng = createRng(`${seed}#opp${fightNumber}`);
  const style = pick(rng, ARCHETYPE_IDS);
  const first = pick(rng, FIRST);
  const nick = pick(rng, NICK);
  const last = pick(rng, LAST);

  const base = ARCHETYPES[style];
  const baseAvg = STAT_IDS.reduce((sum, k) => sum + base[k], 0) / STAT_IDS.length;
  const delta = targetRating(fightNumber) - baseAvg;

  const statLine = {} as StatLine;
  for (const k of STAT_IDS) {
    statLine[k] = clampStat(base[k] + delta);
  }

  return { id: `opp-${fightNumber}`, name: `${first} "${nick}" ${last}`, style, statLine };
}
```
**Step 4 — verify:** `npm run test -- src/domain/opponent.test.ts` → PASS; `npm run typecheck`; `npm run build`. If the exact-vector test fails, STOP — do not edit expected numbers; re-check constants/pick order.
**Step 5 — commit:**
```bash
git add src/domain/opponent.ts src/domain/opponent.test.ts
git commit -m "feat: add opponent generation and difficulty scaling"
```

### Task 3: Fight state, intents, and `startFight` (`fight.ts` part 1)
**Step 1 — failing test.** Create `src/domain/fight.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { StatLine } from './stats';
import { generateOpponent } from './opponent';
import { INTENTS, roundsForFight, durability, startFight } from './fight';

const PLAYER: StatLine = { boxing: 82, kicks: 92, clinch: 80, takedowns: 98, submissions: 97, topControl: 88, cardio: 90, chin: 88, fightIQ: 78 };

describe('roundsForFight', () => {
  it('is 3 rounds through fight 4 and 5 rounds from the title fight on', () => {
    expect([1, 2, 3, 4].map(roundsForFight)).toEqual([3, 3, 3, 3]);
    expect([5, 6, 7].map(roundsForFight)).toEqual([5, 5, 5]);
  });
});

describe('durability', () => {
  it('is 50 + chin/2, rounded', () => {
    expect(durability({ ...PLAYER, chin: 52 })).toBe(76);
    expect(durability({ ...PLAYER, chin: 88 })).toBe(94);
    expect(durability({ ...PLAYER, chin: 40 })).toBe(70);
  });
});

describe('INTENTS table', () => {
  it('maps each intent to its offense/defense pairs and finish method', () => {
    expect(INTENTS.strike).toEqual({ offense: ['boxing', 'kicks'], defense: ['chin', 'fightIQ'], finish: 'KO' });
    expect(INTENTS.clinch).toEqual({ offense: ['clinch', 'cardio'], defense: ['clinch', 'chin'], finish: 'KO' });
    expect(INTENTS.takedown).toEqual({ offense: ['takedowns', 'topControl'], defense: ['takedowns', 'fightIQ'], finish: null });
    expect(INTENTS.submit).toEqual({ offense: ['submissions', 'topControl'], defense: ['submissions', 'chin'], finish: 'submission' });
    expect(INTENTS.outpoint).toEqual({ offense: ['fightIQ', 'cardio'], defense: ['fightIQ', 'cardio'], finish: null });
  });
});

describe('startFight', () => {
  it('builds an in-progress state with the scaled opponent and round 1', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    expect(s.status).toBe('in-progress');
    expect(s.round).toBe(1);
    expect(s.rounds).toBe(3);
    expect(s.history).toEqual([]);
    expect(s.outcome).toBeNull();
    expect(s.player).toEqual({ statLine: PLAYER, damage: 0 });
    expect(s.opponent).toEqual({ ...generateOpponent('run-42', 1), damage: 0 });
  });
  it('seeds the player damage from carryInDamage', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 40 });
    expect(s.player.damage).toBe(40);
  });
  it('uses 5 rounds for the title fight', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 5, playerStatLine: PLAYER });
    expect(s.rounds).toBe(5);
  });
});
```
**Step 2 — run, confirm fail:** `npm run test -- src/domain/fight.test.ts`.
**Step 3 — implement.** Create `src/domain/fight.ts`:
```ts
import type { StatId, StatLine } from './stats';
import type { Opponent } from './opponent';
import { generateOpponent } from './opponent';

const DURA_BASE = 50;
const CHIN_FACTOR = 0.5;

export type Intent = 'strike' | 'clinch' | 'takedown' | 'submit' | 'outpoint';
export type FinishMethod = 'KO' | 'submission' | 'decision';
export type Side = 'player' | 'opponent';

interface IntentConfig {
  offense: [StatId, StatId];
  defense: [StatId, StatId];
  finish: 'KO' | 'submission' | null;
}

export const INTENTS: Record<Intent, IntentConfig> = {
  strike: { offense: ['boxing', 'kicks'], defense: ['chin', 'fightIQ'], finish: 'KO' },
  clinch: { offense: ['clinch', 'cardio'], defense: ['clinch', 'chin'], finish: 'KO' },
  takedown: { offense: ['takedowns', 'topControl'], defense: ['takedowns', 'fightIQ'], finish: null },
  submit: { offense: ['submissions', 'topControl'], defense: ['submissions', 'chin'], finish: 'submission' },
  outpoint: { offense: ['fightIQ', 'cardio'], defense: ['fightIQ', 'cardio'], finish: null },
};

export interface RoundResult {
  round: number;
  intent: Intent;
  dominance: number;
  roundWinner: Side;
  playerDamage: number;
  opponentDamage: number;
}

export interface FightOutcome { method: FinishMethod; round: number; winner: Side; }
export type FightStatus = 'in-progress' | 'won' | 'lost';

export interface FightState {
  seed: string;
  fightNumber: number;
  rounds: number;
  round: number;
  player: { statLine: StatLine; damage: number };
  opponent: Opponent & { damage: number };
  history: RoundResult[];
  status: FightStatus;
  outcome: FightOutcome | null;
}

export interface StartFightArgs {
  seed: string;
  fightNumber: number;
  playerStatLine: StatLine;
  carryInDamage?: number;
}

export function roundsForFight(fightNumber: number): number {
  return fightNumber <= 4 ? 3 : 5;
}

export function durability(statLine: StatLine): number {
  return Math.round(DURA_BASE + statLine.chin * CHIN_FACTOR);
}

export function startFight({ seed, fightNumber, playerStatLine, carryInDamage = 0 }: StartFightArgs): FightState {
  const opponent = generateOpponent(seed, fightNumber);
  return {
    seed,
    fightNumber,
    rounds: roundsForFight(fightNumber),
    round: 1,
    player: { statLine: playerStatLine, damage: carryInDamage },
    opponent: { ...opponent, damage: 0 },
    history: [],
    status: 'in-progress',
    outcome: null,
  };
}
```
**Step 4 — verify:** `npm run test -- src/domain/fight.test.ts` → PASS; `npm run typecheck`; `npm run build`.
**Step 5 — commit:**
```bash
git add src/domain/fight.ts src/domain/fight.test.ts
git commit -m "feat: add fight state, intents, and startFight"
```

### Task 4: Round resolution, finishes, and decision (`fight.ts` part 2)
Resolution math (LOCKED): `yourOff = (player[off0]+player[off1])/2`; `theirDef = (opp[def0]+opp[def1])/2`; `iqTilt = (player.fightIQ − opponent.fightIQ) × IQ_FACTOR`; `roll = createRng(`${seed}#r${round}`)()` (single draw); `rollSwing = (roll − 0.5) × ROLL_RANGE`; `dominance = Math.round((yourOff − theirDef) + iqTilt + rollSwing)`; `dmg = Math.min(MAX_ROUND_DAMAGE, Math.max(0, Math.round(Math.abs(dominance) × DMG_FACTOR)))`; `roundWinner = dominance >= 0 ? 'player' : 'opponent'`; winner deals `dmg` to loser. Player finish: `INTENTS[intent].finish !== null` AND `opponentDamage >= durability(opp.statLine)` ⇒ won, method = intent finish. Opponent finish: `playerDamage >= durability(player.statLine)` ⇒ lost, method = `STYLE_FINISH[opponent.style]`. Decision (no finish, final round): `playerRoundsWon >= opponentRoundsWon ? 'player' : 'opponent'`, method 'decision', `outcome.round = state.rounds`, `round` stays at final round. Otherwise advance `round + 1`, status stays `in-progress`. Settled fight → throw. Unknown intent → throw.

**Step 1 — failing tests.** Append to `src/domain/fight.test.ts`:
```ts
import { resolveRound, carryOutDamage } from './fight';
import type { FightState } from './fight';

describe('resolveRound', () => {
  it('produces the exact strike vectors and a decision win vs seed "run-42" fight 1', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    s = resolveRound(s, 'strike');
    expect(s.history[0]).toMatchObject({ round: 1, dominance: 30, roundWinner: 'player', opponentDamage: 18 });
    s = resolveRound(s, 'strike');
    expect(s.history[1]).toMatchObject({ round: 2, dominance: 40, roundWinner: 'player', opponentDamage: 42 });
    s = resolveRound(s, 'strike');
    expect(s.history[2]).toMatchObject({ round: 3, dominance: 25, roundWinner: 'player', opponentDamage: 57 });
    expect(s.status).toBe('won');
    expect(s.outcome).toEqual({ method: 'decision', round: 3, winner: 'player' });
  });

  it('never finishes in round 1 from full health, even in a blowout (measured)', () => {
    const seeds = ['run-42', 'title-run', 'abc', 'seed-7', 'xyz', 'k'];
    for (const seed of seeds) {
      for (let n = 1; n <= 8; n++) {
        for (const intent of ['strike', 'clinch', 'takedown', 'submit', 'outpoint'] as const) {
          let s = startFight({ seed, fightNumber: n, playerStatLine: PLAYER });
          s = resolveRound(s, intent);
          if (s.status !== 'in-progress' && s.round === 1) {
            expect(s.outcome?.method).toBe('decision');
          }
        }
      }
    }
  });

  it('finishes by submission when accumulated damage crosses durability', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    const threshold = durability(s.opponent.statLine);
    const primed: FightState = {
      ...s,
      round: 2,
      opponent: { ...s.opponent, damage: threshold - 1 },
      history: [{ round: 1, intent: 'submit', dominance: 20, roundWinner: 'player', playerDamage: 0, opponentDamage: threshold - 1 }],
    };
    const done = resolveRound(primed, 'submit');
    expect(done.status).toBe('won');
    expect(done.outcome).toEqual({ method: 'submission', round: 2, winner: 'player' });
  });

  it('cannot finish with a control intent even past durability (takedown wins by decision only)', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    const threshold = durability(s.opponent.statLine);
    const primed: FightState = {
      ...s,
      round: 3,
      opponent: { ...s.opponent, damage: threshold + 50 },
      history: [
        { round: 1, intent: 'takedown', dominance: 20, roundWinner: 'player', playerDamage: 0, opponentDamage: threshold + 25 },
        { round: 2, intent: 'takedown', dominance: 20, roundWinner: 'player', playerDamage: 0, opponentDamage: threshold + 50 },
      ],
    };
    const done = resolveRound(primed, 'takedown');
    expect(done.status).toBe('won');
    expect(done.outcome?.method).toBe('decision');
  });

  it('lets the opponent finish the player by their style method', () => {
    const WEAK: StatLine = { boxing: 40, kicks: 40, clinch: 40, takedowns: 40, submissions: 40, topControl: 40, cardio: 40, chin: 40, fightIQ: 40 };
    let s = startFight({ seed: 'run-42', fightNumber: 6, playerStatLine: WEAK });
    expect(s.opponent.style).toBe('brawler');
    while (s.status === 'in-progress') s = resolveRound(s, 'outpoint');
    expect(s.status).toBe('lost');
    expect(s.outcome).toEqual({ method: 'KO', round: 4, winner: 'opponent' });
  });

  it('throws when resolving a settled fight', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    while (s.status === 'in-progress') s = resolveRound(s, 'strike');
    expect(() => resolveRound(s, 'strike')).toThrow(/won|lost|in-progress/);
  });
});

describe('carryOutDamage', () => {
  it('returns the player damage carried out of a won fight', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 12 });
    while (s.status === 'in-progress') s = resolveRound(s, 'strike');
    expect(s.status).toBe('won');
    expect(carryOutDamage(s)).toBe(s.player.damage);
  });
  it('throws if the fight was not won', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    expect(() => carryOutDamage(s)).toThrow(/not won/);
  });
});
```
**Step 2 — run, confirm fail:** `npm run test -- src/domain/fight.test.ts`.
**Step 3 — implement.** Add to the top constants block of `src/domain/fight.ts` (next to `DURA_BASE`):
```ts
const IQ_FACTOR = 0.1;
const ROLL_RANGE = 30;
const DMG_FACTOR = 0.6;
const MAX_ROUND_DAMAGE = 32;

const STYLE_FINISH: Record<Opponent['style'], 'KO' | 'submission'> = {
  striker: 'KO',
  brawler: 'KO',
  allrounder: 'KO',
  grappler: 'submission',
  wrestler: 'submission',
};
```
Add import at top of file: `import { createRng } from './rng';`
Append to `src/domain/fight.ts`:
```ts
function pairAvg(statLine: StatLine, pair: [StatId, StatId]): number {
  return (statLine[pair[0]] + statLine[pair[1]]) / 2;
}

export function resolveRound(state: FightState, intent: Intent): FightState {
  if (state.status !== 'in-progress') {
    throw new Error(`resolveRound: fight is already ${state.status}`);
  }
  const cfg = INTENTS[intent];
  if (!cfg) {
    throw new Error(`resolveRound: unknown intent "${intent}"`);
  }

  const p = state.player.statLine;
  const o = state.opponent.statLine;
  const yourOff = pairAvg(p, cfg.offense);
  const theirDef = pairAvg(o, cfg.defense);
  const iqTilt = (p.fightIQ - o.fightIQ) * IQ_FACTOR;
  const roll = createRng(`${state.seed}#r${state.round}`)();
  const rollSwing = (roll - 0.5) * ROLL_RANGE;
  const dominance = Math.round(yourOff - theirDef + iqTilt + rollSwing);
  const dmg = Math.min(MAX_ROUND_DAMAGE, Math.max(0, Math.round(Math.abs(dominance) * DMG_FACTOR)));

  const roundWinner: Side = dominance >= 0 ? 'player' : 'opponent';
  let playerDamage = state.player.damage;
  let opponentDamage = state.opponent.damage;
  if (roundWinner === 'player') {
    opponentDamage += dmg;
  } else {
    playerDamage += dmg;
  }

  const result: RoundResult = { round: state.round, intent, dominance, roundWinner, playerDamage, opponentDamage };
  const history = [...state.history, result];
  const next: FightState = {
    ...state,
    player: { ...state.player, damage: playerDamage },
    opponent: { ...state.opponent, damage: opponentDamage },
    history,
  };

  if (roundWinner === 'player' && cfg.finish !== null && opponentDamage >= durability(o)) {
    return { ...next, status: 'won', outcome: { method: cfg.finish, round: state.round, winner: 'player' } };
  }
  if (roundWinner === 'opponent' && playerDamage >= durability(p)) {
    return { ...next, status: 'lost', outcome: { method: STYLE_FINISH[state.opponent.style], round: state.round, winner: 'opponent' } };
  }
  if (state.round >= state.rounds) {
    const playerRoundsWon = history.filter((r) => r.roundWinner === 'player').length;
    const opponentRoundsWon = history.length - playerRoundsWon;
    const winner: Side = playerRoundsWon >= opponentRoundsWon ? 'player' : 'opponent';
    return { ...next, status: winner === 'player' ? 'won' : 'lost', outcome: { method: 'decision', round: state.rounds, winner } };
  }
  return { ...next, round: state.round + 1 };
}

export function carryOutDamage(state: FightState): number {
  if (state.status !== 'won') {
    throw new Error('carryOutDamage: fight was not won');
  }
  return state.player.damage;
}
```
**Step 4 — verify:** `npm run test -- src/domain/fight.test.ts` → PASS. If any determinism vector differs, STOP and report the diff — do NOT change expected numbers. Then `npm run typecheck`; `npm run build`; `npm run test` (full suite).
**Step 5 — commit:**
```bash
git add src/domain/fight.ts src/domain/fight.test.ts
git commit -m "feat: add round resolution, finishes, and decision"
```

### Task 5: Export the fight engine from the domain barrel
**Step 1 — failing test.** Append to the existing `src/domain/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as domain from './index';

describe('domain barrel exports the fight engine', () => {
  it('re-exports opponent + fight entry points', () => {
    expect(typeof domain.generateOpponent).toBe('function');
    expect(typeof domain.targetRating).toBe('function');
    expect(typeof domain.startFight).toBe('function');
    expect(typeof domain.resolveRound).toBe('function');
    expect(typeof domain.carryOutDamage).toBe('function');
    expect(typeof domain.roundsForFight).toBe('function');
    expect(typeof domain.durability).toBe('function');
    expect(domain.INTENTS.strike.finish).toBe('KO');
  });
});
```
**Step 2 — run, confirm fail:** `npm run test -- src/domain/index.test.ts`.
**Step 3 — implement.** In `src/domain/index.ts` append:
```ts
export * from './opponent';
export * from './fight';
```
**Step 4 — verify:** `npm run test -- src/domain/index.test.ts` → PASS; `npm run test` (all); `npm run typecheck`; `npm run build`.
**Step 5 — commit:**
```bash
git add src/domain/index.ts src/domain/index.test.ts
git commit -m "feat: export fight engine from domain barrel"
```

---

## Determinism vectors (baked — source of truth)
- `targetRating(1..8)` = `[58, 62, 66, 70, 74, 79, 84, 89]`. `roundsForFight`: 3 for 1–4, 5 for 5+.
- `durability`: chin 52 → 76, chin 88 → 94, chin 40 → 70, chin 1 → 51 (minimum). `MAX_ROUND_DAMAGE = 32 < 51` ⇒ no one-shot from full health.
- `generateOpponent('run-42', 1)` = `{ id: 'opp-1', name: 'Hideo "Granite" Stone', style: 'grappler', statLine: { boxing:44, kicks:42, clinch:58, takedowns:66, submissions:74, topControl:72, cardio:56, chin:52, fightIQ:62 } }` (avg 58).
- Player reference stat line: `{ boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 }`.
- `resolveRound` all-`strike` vs `run-42` fight 1: r1 dominance 30 (oppDmg 18), r2 dominance 40 (oppDmg 42), r3 dominance 25 (oppDmg 57) → decision win.
- Loss path: WEAK (all 40) vs `run-42` fight 6 (`Lars "The Surgeon" Rivas`, brawler), all `outpoint` → player damage 23, 40, 66, 80; KO loss at round 4.
- Measured invariant: 6 seeds × 8 fights × 5 intents = 240 first-rounds-from-full, zero finishes in round 1.
