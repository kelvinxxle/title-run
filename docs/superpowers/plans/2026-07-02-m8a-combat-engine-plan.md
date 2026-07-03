# M8a — Combat Engine (v2 domain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire v2 fight — new offense/defense stat model, per-round tactical sub-choices, a stamina economy, finish windows (damage OR read) resolved by a pressure-decision sequence, and judges — as a pure, seeded, unit-tested domain engine that lives alongside v1 and is NOT yet wired into the UI.

**Architecture:** A new self-contained package `src/domain/combat/` holds the v2 stat vocabulary, starter roster, draft, stamina economy, fight engine, opponent generation/scaling, and run flow (rewards removed, fresh each fight). It does not import or modify any v1 domain/screen file, so the existing app stays green and shippable throughout. Determinism is preserved via the existing seeded RNG pattern (`createRng(\`${seed}#...\`)`). The cutover (rewire App + screens, delete v1 combat, fix Hub, remove reward screen) is a **separate milestone M8b**, planned after this merges.

**Tech Stack:** TypeScript (strict), Vitest. Pure functions only — no React, no `Math.random`, no new runtime deps.

## Global Constraints

- Client-only; no backend; no new runtime deps beyond `react`/`react-dom` (this milestone adds none — domain only).
- Pure, deterministic, seeded domain: same `(seed, fightNumber, intents)` ⇒ same outcome. **No `Math.random` anywhere in `src`.**
- All new code under `src/domain/combat/`. **Do not modify or import any v1 file** (`src/domain/stats.ts`, `fight.ts`, `run.ts`, `opponent.ts`, `roster.ts`, `archetypes.ts`, `draft.ts`, screens, `App.tsx`). v1 stays green.
- Stat scale: integers `1..99`; reuse the clamp convention (`Math.max(1, Math.min(99, Math.round(x)))`).
- 9-stat model: `striking, strikingDef, takedowns, takedownDef, submissions, submissionDef, cardio, chin, fightIQ`.
- Round format: 3 rounds normal; **5 rounds for the title fight (fight 5) and every title defense (fight ≥ 5)**.
- Run: fighter fixed for the run; **every fight starts fresh (full health + stamina)**; belt at fight 5; permadeath on first loss; **score = successful title defenses (reign)**; **no between-fight rewards**.
- Every commit trailered exactly: `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- Numeric constants introduced in Tasks 3–8 are **initial values**; Task 11 (tuning) adjusts them to hit the success-criteria bands. Do not hand-tune elsewhere.

---

### Task 1: v2 stat vocabulary

**Files:**
- Create: `src/domain/combat/stats.ts`
- Test: `src/domain/combat/stats.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type StatId` (the 9 v2 stats); `STAT_IDS: readonly StatId[]`; `STAT_LABELS: Record<StatId,string>`; `type StatLine = Record<StatId, number>`; `STAT_MIN=1`, `STAT_MAX=99`; `clampStat(n:number):number`; `isStatId(v:unknown):v is StatId`. Also two grouping helpers used by the engine: `OFFENSE_FOR: Record<Where, StatId>` and `DEFENSE_FOR: Record<Where, StatId>` where `type Where = 'strike'|'wrestle'|'grapple'` — but `Where` is defined in Task 2's `intents.ts`; to avoid a cycle, keep `stats.ts` free of `Where` and instead export raw maps consumed later: `PHASE_OFFENSE = { strike:'striking', wrestle:'takedowns', grapple:'submissions' } as const` and `PHASE_DEFENSE = { strike:'strikingDef', wrestle:'takedownDef', grapple:'submissionDef' } as const`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { STAT_IDS, STAT_LABELS, clampStat, isStatId, PHASE_OFFENSE, PHASE_DEFENSE } from './stats';

describe('v2 stats', () => {
  it('has the 9 offense/defense stats', () => {
    expect(STAT_IDS).toEqual([
      'striking','strikingDef','takedowns','takedownDef',
      'submissions','submissionDef','cardio','chin','fightIQ',
    ]);
  });
  it('labels every stat', () => {
    for (const id of STAT_IDS) expect(STAT_LABELS[id]).toBeTruthy();
  });
  it('clamps to 1..99 and rounds', () => {
    expect(clampStat(-5)).toBe(1);
    expect(clampStat(140)).toBe(99);
    expect(clampStat(63.6)).toBe(64);
  });
  it('isStatId narrows unknown', () => {
    expect(isStatId('striking')).toBe(true);
    expect(isStatId('boxing')).toBe(false);
    expect(isStatId(5)).toBe(false);
  });
  it('maps each phase to its offensive and defensive stat', () => {
    expect(PHASE_OFFENSE).toEqual({ strike:'striking', wrestle:'takedowns', grapple:'submissions' });
    expect(PHASE_DEFENSE).toEqual({ strike:'strikingDef', wrestle:'takedownDef', grapple:'submissionDef' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/domain/combat/stats.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
export type StatId =
  | 'striking' | 'strikingDef'
  | 'takedowns' | 'takedownDef'
  | 'submissions' | 'submissionDef'
  | 'cardio' | 'chin' | 'fightIQ';

export const STAT_IDS: readonly StatId[] = [
  'striking','strikingDef','takedowns','takedownDef',
  'submissions','submissionDef','cardio','chin','fightIQ',
] as const;

export const STAT_LABELS: Record<StatId, string> = {
  striking: 'Striking', strikingDef: 'Striking Defense',
  takedowns: 'Takedowns', takedownDef: 'Takedown Defense',
  submissions: 'Submissions', submissionDef: 'Submission Defense',
  cardio: 'Cardio', chin: 'Chin', fightIQ: 'Fight IQ',
};

export type StatLine = Record<StatId, number>;
export const STAT_MIN = 1;
export const STAT_MAX = 99;

export function clampStat(value: number): number {
  return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(value)));
}
export function isStatId(value: unknown): value is StatId {
  return typeof value === 'string' && (STAT_IDS as readonly string[]).includes(value);
}

export const PHASE_OFFENSE = { strike: 'striking', wrestle: 'takedowns', grapple: 'submissions' } as const;
export const PHASE_DEFENSE = { strike: 'strikingDef', wrestle: 'takedownDef', grapple: 'submissionDef' } as const;
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run src/domain/combat/stats.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(combat): v2 offense/defense stat vocabulary"` (+ trailer).

---

### Task 2: Round intents + archetypes

**Files:**
- Create: `src/domain/combat/intents.ts`, `src/domain/combat/archetypes.ts`
- Test: `src/domain/combat/intents.test.ts`, `src/domain/combat/archetypes.test.ts`

**Interfaces:**
- Consumes: `StatLine`, `clampStat` from `./stats`.
- Produces:
  - `type Where = 'strike'|'wrestle'|'grapple'`; `type Target = 'head'|'body'`; `type Approach = 'pressure'|'technical'|'counter'`.
  - `interface RoundIntent { where: Where; target: Target; approach: Approach }`.
  - `WHERES`, `TARGETS`, `APPROACHES` readonly arrays; `INTENT_LABELS` for UI copy later.
  - `type ArchetypeId = 'striker'|'wrestler'|'grappler'|'allrounder'|'brawler'`; `ARCHETYPES: Record<ArchetypeId, StatLine>`; `ARCHETYPE_IDS`.

- [ ] **Step 1: Write the failing test** (`intents.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { WHERES, TARGETS, APPROACHES, INTENT_LABELS } from './intents';

describe('round intents', () => {
  it('offers 3 wheres, 2 targets, 3 approaches', () => {
    expect(WHERES).toEqual(['strike','wrestle','grapple']);
    expect(TARGETS).toEqual(['head','body']);
    expect(APPROACHES).toEqual(['pressure','technical','counter']);
  });
  it('labels every choice for the UI', () => {
    for (const w of WHERES) expect(INTENT_LABELS.where[w]).toBeTruthy();
    for (const t of TARGETS) expect(INTENT_LABELS.target[t]).toBeTruthy();
    for (const a of APPROACHES) expect(INTENT_LABELS.approach[a]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify fail** — module not found.

- [ ] **Step 3: Implement** (`intents.ts`)

```ts
export type Where = 'strike' | 'wrestle' | 'grapple';
export type Target = 'head' | 'body';
export type Approach = 'pressure' | 'technical' | 'counter';

export interface RoundIntent { where: Where; target: Target; approach: Approach; }

export const WHERES: readonly Where[] = ['strike','wrestle','grapple'] as const;
export const TARGETS: readonly Target[] = ['head','body'] as const;
export const APPROACHES: readonly Approach[] = ['pressure','technical','counter'] as const;

export const INTENT_LABELS = {
  where: { strike: 'Strike', wrestle: 'Wrestle', grapple: 'Grapple' } as Record<Where,string>,
  target: { head: 'Head', body: 'Body' } as Record<Target,string>,
  approach: { pressure: 'Pressure', technical: 'Technical', counter: 'Counter' } as Record<Approach,string>,
};
```

- [ ] **Step 4: Write `archetypes.test.ts`** — assert each archetype's dominant stat matches its identity (initial values; tunable in Task 11):

```ts
import { describe, it, expect } from 'vitest';
import { ARCHETYPES } from './archetypes';

describe('archetypes', () => {
  it('striker leads on striking, brawler on chin, wrestler on takedowns, grappler on submissions', () => {
    expect(ARCHETYPES.striker.striking).toBeGreaterThanOrEqual(75);
    expect(ARCHETYPES.brawler.chin).toBeGreaterThanOrEqual(80);
    expect(ARCHETYPES.wrestler.takedowns).toBeGreaterThanOrEqual(80);
    expect(ARCHETYPES.grappler.submissions).toBeGreaterThanOrEqual(80);
  });
  it('every archetype defines all 9 stats within range', () => {
    for (const line of Object.values(ARCHETYPES)) {
      for (const v of Object.values(line)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(99); }
    }
  });
});
```

- [ ] **Step 5: Implement `archetypes.ts`** (initial base lines; note defensive stats are first-class):

```ts
import type { StatLine } from './stats';

export type ArchetypeId = 'striker' | 'wrestler' | 'grappler' | 'allrounder' | 'brawler';

export const ARCHETYPES: Record<ArchetypeId, StatLine> = {
  striker:    { striking: 80, strikingDef: 74, takedowns: 42, takedownDef: 66, submissions: 40, submissionDef: 58, cardio: 64, chin: 62, fightIQ: 68 },
  wrestler:   { striking: 60, strikingDef: 64, takedowns: 84, takedownDef: 82, submissions: 58, submissionDef: 70, cardio: 76, chin: 66, fightIQ: 68 },
  grappler:   { striking: 54, strikingDef: 58, takedowns: 70, takedownDef: 64, submissions: 84, submissionDef: 82, cardio: 66, chin: 60, fightIQ: 72 },
  allrounder: { striking: 72, strikingDef: 72, takedowns: 68, takedownDef: 70, submissions: 66, submissionDef: 68, cardio: 74, chin: 68, fightIQ: 78 },
  brawler:    { striking: 82, strikingDef: 54, takedowns: 46, takedownDef: 56, submissions: 42, submissionDef: 50, cardio: 54, chin: 84, fightIQ: 54 },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];
```

- [ ] **Step 6: Run both test files** → PASS. **Commit** — `feat(combat): round intents + v2 archetypes`.

---

### Task 3: Starter roster + stat-line builder

**Files:**
- Create: `src/domain/combat/roster.ts`
- Test: `src/domain/combat/roster.test.ts`

**Interfaces:**
- Consumes: `StatLine`, `STAT_IDS`, `clampStat` from `./stats`; `ARCHETYPES`, `ArchetypeId` from `./archetypes`; `Rng`, `pick` from `../rng` (reuse v1 RNG — read-only import, does not modify it).
- Produces: `interface Fighter { id:string; name:string; archetype:ArchetypeId; signature: Partial<StatLine> }`; `STARTER_ROSTER: readonly Fighter[]` (8 real fighters spanning archetypes incl. one deliberately weak); `buildStatLine(f:Fighter):StatLine`; `getFighter(id):Fighter`; `rollFighter(rng, excludeIds?):Fighter`.

**Note:** Importing `../rng` is allowed — it is a stable shared utility, not v1 combat logic, and is not being modified.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { STARTER_ROSTER, buildStatLine, rollFighter } from './roster';
import { createRng } from '../rng';

describe('starter roster', () => {
  it('has 8 fighters covering all five archetypes plus a weak one', () => {
    expect(STARTER_ROSTER).toHaveLength(8);
    const kinds = new Set(STARTER_ROSTER.map((f) => f.archetype));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    // a deliberately weak fighter exists
    const weak = STARTER_ROSTER.map(buildStatLine)
      .map((l) => Object.values(l).reduce((a, b) => a + b, 0) / 9);
    expect(Math.min(...weak)).toBeLessThan(60);
  });
  it('buildStatLine overlays signature onto the archetype base and clamps', () => {
    const line = buildStatLine(STARTER_ROSTER[0]);
    for (const v of Object.values(line)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(99); }
  });
  it('rollFighter is deterministic per seed and can exclude', () => {
    const a = rollFighter(createRng('s#0'));
    const b = rollFighter(createRng('s#0'));
    expect(a.id).toBe(b.id);
    const c = rollFighter(createRng('s#0'), [a.id]);
    expect(c.id).not.toBe(a.id);
  });
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — an 8-fighter starter set (real fighters, distinct identities, one weak). Signatures are initial and tunable in Task 11.

```ts
import { STAT_IDS, clampStat, type StatLine } from './stats';
import { ARCHETYPES, type ArchetypeId } from './archetypes';
import { pick, type Rng } from '../rng';

export interface Fighter { id: string; name: string; archetype: ArchetypeId; signature: Partial<StatLine>; }

export const STARTER_ROSTER: readonly Fighter[] = [
  { id: 'israel-adesanya', name: 'Israel Adesanya', archetype: 'striker',    signature: { striking: 92, strikingDef: 86, fightIQ: 84, chin: 68 } },
  { id: 'khabib-nurmagomedov', name: 'Khabib Nurmagomedov', archetype: 'wrestler', signature: { takedowns: 96, takedownDef: 88, cardio: 88, submissionDef: 84, fightIQ: 86 } },
  { id: 'charles-oliveira', name: 'Charles Oliveira', archetype: 'grappler', signature: { submissions: 96, submissionDef: 78, takedowns: 74, chin: 56, strikingDef: 54 } },
  { id: 'georges-st-pierre', name: 'Georges St-Pierre', archetype: 'allrounder', signature: { takedowns: 90, takedownDef: 86, fightIQ: 94, cardio: 88 } },
  { id: 'francis-ngannou', name: 'Francis Ngannou', archetype: 'brawler',  signature: { striking: 96, chin: 80, strikingDef: 50, cardio: 50, takedownDef: 52 } },
  { id: 'max-holloway', name: 'Max Holloway', archetype: 'striker',        signature: { striking: 90, strikingDef: 80, cardio: 92, chin: 82 } },
  { id: 'demian-maia', name: 'Demian Maia', archetype: 'grappler',        signature: { submissions: 95, submissionDef: 80, takedowns: 84, striking: 44, strikingDef: 48 } },
  // deliberately weak journeyman (avg < 60) — an easy early-ladder draw and a cautionary draft
  { id: 'journeyman-doe', name: 'Danny "Gatekeeper" Doe', archetype: 'brawler', signature: { striking: 54, strikingDef: 44, takedowns: 42, takedownDef: 46, submissions: 38, submissionDef: 44, cardio: 50, chin: 58, fightIQ: 48 } },
];

export function buildStatLine(fighter: Fighter): StatLine {
  const base = ARCHETYPES[fighter.archetype];
  const line = {} as StatLine;
  for (const stat of STAT_IDS) line[stat] = clampStat(fighter.signature[stat] ?? base[stat]);
  return line;
}
export function getFighter(id: string): Fighter {
  const f = STARTER_ROSTER.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown fighter id: ${id}`);
  return f;
}
export function rollFighter(rng: Rng, excludeIds: readonly string[] = []): Fighter {
  const pool = STARTER_ROSTER.filter((f) => !excludeIds.includes(f.id));
  return pick(rng, pool.length > 0 ? pool : STARTER_ROSTER);
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(combat): v2 starter roster + stat-line builder`.

---

### Task 4: Draft over the v2 stat sheet

**Files:**
- Create: `src/domain/combat/draft.ts`
- Test: `src/domain/combat/draft.test.ts`

**Interfaces:**
- Consumes: `STAT_IDS`, `StatId`, `StatLine` from `./stats`; `buildStatLine`, `rollFighter`, `Fighter` from `./roster`; `createRng` from `../rng`.
- Produces: `interface DraftState`; `startDraft(seed):DraftState`; `availableStatIds`, `filledCount`, `suggestedStatId`, `keepStat(state, statId)`, `nameFighter(state, name)`, `getDraftedFighter(state):{ name; statLine }`. Mirrors the v1 draft contract (keep one stat per roll, no skip/reroll) but over the v2 9-stat sheet. Reuse the v1 draft's proven per-roll seed `createRng(\`${seed}#${rollCount}\`)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { startDraft, keepStat, availableStatIds, nameFighter, getDraftedFighter } from './draft';

describe('v2 draft', () => {
  it('fills all 9 slots by keeping one stat per roll, then names', () => {
    let d = startDraft('seed-1');
    while (d.status === 'drafting') d = keepStat(d, availableStatIds(d)[0]);
    expect(d.status).toBe('naming');
    d = nameFighter(d, 'Kid Dynamite');
    const drafted = getDraftedFighter(d);
    expect(Object.keys(drafted.statLine)).toHaveLength(9);
    expect(drafted.name).toBe('Kid Dynamite');
  });
  it('is deterministic per seed', () => {
    const first = startDraft('same').current;
    const again = startDraft('same').current;
    expect(first).toEqual(again);
  });
});
```

- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement** — port the v1 `draft.ts` logic verbatim but importing v2 `./stats` and `./roster` (the algorithm is generic over `STAT_IDS`). Include `DraftStatus = 'drafting'|'naming'|'complete'`, `SlotFill`, `RolledFighter`, the guards, and `getDraftedFighter`. (Copy the v1 structure — do not reference v1 files.)
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(combat): draft over the v2 stat sheet`.

---

### Task 5: Stamina economy

**Files:**
- Create: `src/domain/combat/stamina.ts`
- Test: `src/domain/combat/stamina.test.ts`

**Interfaces:**
- Consumes: `StatLine` from `./stats`; `Where`, `Approach` from `./intents`.
- Produces:
  - `STAMINA_MAX = 100`.
  - `startingStamina(statLine):number` (currently `STAMINA_MAX`; cardio governs recovery, not the cap).
  - `staminaCost(where:Where, approach:Approach):number` — pressure & wrestle/grapple cost more, counter/technical less.
  - `recovery(statLine):number` — per-round recovery scaled by cardio.
  - `GAS_THRESHOLD = 25`; `isGassed(stamina):boolean`; `effortMultiplier(stamina):number` — a 0.6..1.0 multiplier applied to effective offense/defense when low (full when fresh, degraded when gassed).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { staminaCost, recovery, isGassed, effortMultiplier, STAMINA_MAX } from './stamina';
import { ARCHETYPES } from './archetypes';

describe('stamina economy', () => {
  it('pressure costs more than technical, which costs more than counter', () => {
    expect(staminaCost('strike','pressure')).toBeGreaterThan(staminaCost('strike','technical'));
    expect(staminaCost('strike','technical')).toBeGreaterThan(staminaCost('strike','counter'));
  });
  it('wrestling costs more than striking for the same approach', () => {
    expect(staminaCost('wrestle','pressure')).toBeGreaterThan(staminaCost('strike','pressure'));
  });
  it('higher cardio recovers more between rounds', () => {
    expect(recovery(ARCHETYPES.wrestler)).toBeGreaterThan(recovery(ARCHETYPES.brawler));
  });
  it('gassing degrades effort; fresh is full', () => {
    expect(isGassed(10)).toBe(true);
    expect(effortMultiplier(STAMINA_MAX)).toBe(1);
    expect(effortMultiplier(0)).toBeLessThan(1);
    expect(effortMultiplier(0)).toBeGreaterThanOrEqual(0.6);
  });
});
```

- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement** (initial constants, tunable in Task 11)

```ts
import type { StatLine } from './stats';
import type { Where, Approach } from './intents';

export const STAMINA_MAX = 100;
export const GAS_THRESHOLD = 25;

const WHERE_COST: Record<Where, number> = { strike: 10, wrestle: 16, grapple: 14 };
const APPROACH_MULT: Record<Approach, number> = { pressure: 1.6, technical: 1.0, counter: 0.6 };

export function startingStamina(_statLine: StatLine): number { return STAMINA_MAX; }
export function staminaCost(where: Where, approach: Approach): number {
  return Math.round(WHERE_COST[where] * APPROACH_MULT[approach]);
}
export function recovery(statLine: StatLine): number {
  return Math.round(4 + statLine.cardio * 0.12); // ~13 at cardio 75
}
export function isGassed(stamina: number): boolean { return stamina < GAS_THRESHOLD; }
export function effortMultiplier(stamina: number): number {
  const t = Math.max(0, Math.min(1, stamina / STAMINA_MAX));
  return 0.6 + 0.4 * t; // 1.0 fresh → 0.6 empty
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(combat): stamina economy`.

---

### Task 6: Fight state + startFight + opponent AI intent

**Files:**
- Create: `src/domain/combat/fightState.ts`
- Test: `src/domain/combat/fightState.test.ts`

**Interfaces:**
- Consumes: `StatLine` from `./stats`; `RoundIntent`, `Where` from `./intents`; `STAMINA_MAX`, `startingStamina` from `./stamina`; `Opponent` from `./opponent` (Task 9 — but to avoid ordering, define a minimal local `interface Combatant` here and have `opponent.ts` produce something assignable; the opponent object shape is `{ id; name; archetype; statLine }`). Reuse `createRng` from `../rng`.
- Produces:
  - `interface Fighter2 { statLine: StatLine; headDamage: number; bodyDamage: number; stamina: number; roundScore: number }` (internal per-side state; `bodyDamage` reduces effective stamina recovery/offense later).
  - `type FightPhase = 'in-round' | 'finish-window' | 'finished'`.
  - `interface FinishWindow { side: 'player'|'opponent'; method: 'KO'|'submission'; stepsLeft: number }`.
  - `interface FightOutcome { winner: 'player'|'opponent'; method: 'KO'|'submission'|'decision'; round: number }`.
  - `interface FightState { seed; fightNumber; rounds; round; phase: FightPhase; player: Fighter2; opponent: Fighter2 & { name:string; archetype:string }; window: FinishWindow | null; outcome: FightOutcome | null; log: RoundLogEntry[] }`.
  - `roundsForFight(fightNumber):number` (3, or 5 when `fightNumber >= 5`).
  - `startFight(args:{ seed:string; fightNumber:number; playerStatLine:StatLine; opponent:OpponentLike }):FightState`.
  - `opponentIntent(state:FightState):RoundIntent` — deterministic AI: choose `where` by the opponent's strongest phase, `target` head unless the player is low-stamina (then body to finish), `approach` scaling with fightNumber/aggression; seeded by `createRng(\`${seed}#f${fightNumber}#ai${round}\`)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { startFight, roundsForFight, opponentIntent } from './fightState';
import { ARCHETYPES } from './archetypes';

const OPP = { id: 'o1', name: 'Test Foe', archetype: 'wrestler' as const, statLine: ARCHETYPES.wrestler };

describe('fight state', () => {
  it('title fight and defenses are 5 rounds, others 3', () => {
    expect(roundsForFight(1)).toBe(3);
    expect(roundsForFight(5)).toBe(5);
    expect(roundsForFight(7)).toBe(5);
  });
  it('starts fresh: full stamina, zero damage, round 1, in-round', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(s.round).toBe(1);
    expect(s.phase).toBe('in-round');
    expect(s.player.headDamage).toBe(0);
    expect(s.player.stamina).toBe(100);
    expect(s.opponent.stamina).toBe(100);
    expect(s.outcome).toBeNull();
  });
  it('a wrestler AI prefers to wrestle and is deterministic', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(opponentIntent(s).where).toBe('wrestle');
    expect(opponentIntent(s)).toEqual(opponentIntent(s));
  });
});
```

- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement** the state factory, `roundsForFight`, and a deterministic `opponentIntent` (pick strongest of striking/takedowns/submissions → where; head default; approach from a seeded roll biased by fightNumber). Keep `OpponentLike = { id:string; name:string; archetype:string; statLine:StatLine }`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(combat): fight state, startFight, opponent AI intent`.

---

### Task 7: Round resolution (damage, stamina, scoring) — no finishes yet

**Files:**
- Create: `src/domain/combat/resolve.ts`
- Modify: `src/domain/combat/fightState.ts` (add `RoundLogEntry` type if not already)
- Test: `src/domain/combat/resolve.test.ts`

**Interfaces:**
- Consumes: everything above; `PHASE_OFFENSE`, `PHASE_DEFENSE` from `./stats`; `staminaCost`, `recovery`, `effortMultiplier`, `isGassed` from `./stamina`.
- Produces: `resolveRound(state:FightState, playerIntent:RoundIntent):FightState`. Computes, deterministically via `createRng(\`${seed}#f${fightNumber}#r${round}\`)`:
  - opponent intent via `opponentIntent`;
  - each side's effective offense = `statLine[PHASE_OFFENSE[where]] * effortMultiplier(stamina) * approachAtk` and effective defense = `statLine[PHASE_DEFENSE[oppWhere]] * effortMultiplier * approachDef`, plus a `counter` bonus when a `counter` approach meets the opponent's `pressure`;
  - `dominance = playerEff - oppEff + (fightIQ diff)*IQ_FACTOR + seededSwing`;
  - damage to the round loser: head target adds `headDamage`, body target adds `bodyDamage` (body reduces the victim's next-round recovery); scaled by dominance;
  - subtract `staminaCost` from each actor, then add `recovery` (net); clamp stamina `0..100`;
  - accrue `roundScore` for judges (round winner +1 plus a margin bonus);
  - append a `RoundLogEntry`; advance `round` (do NOT yet finish — finishes are Task 8; at final round with no finish, leave `phase` for Task 10's judges hook; for now set `phase='finished'` only via a temporary decision fallback so tests can assert scoring — **replace in Task 10**). Mark this fallback with a `// TEMP: replaced by judges in Task 10` comment.

- [ ] **Step 1: Write the failing test** — assert determinism, body-target accumulates bodyDamage, gassing reduces damage output, and stamina is spent:

```ts
import { describe, it, expect } from 'vitest';
import { startFight } from './fightState';
import { resolveRound } from './resolve';
import { ARCHETYPES } from './archetypes';

const OPP = { id: 'o', name: 'Foe', archetype: 'brawler' as const, statLine: ARCHETYPES.brawler };
const start = () => startFight({ seed: 'seed-42', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });

describe('resolveRound', () => {
  it('is deterministic for the same seed + intent', () => {
    const a = resolveRound(start(), { where:'strike', target:'head', approach:'technical' });
    const b = resolveRound(start(), { where:'strike', target:'head', approach:'technical' });
    expect(a).toEqual(b);
  });
  it('spends stamina (pressure spends more than counter over a round)', () => {
    const p = resolveRound(start(), { where:'strike', target:'head', approach:'pressure' });
    const c = resolveRound(start(), { where:'strike', target:'head', approach:'counter' });
    expect(p.player.stamina).toBeLessThan(c.player.stamina);
  });
  it('body targeting accumulates body damage on the loser side', () => {
    const s = resolveRound(start(), { where:'strike', target:'body', approach:'pressure' });
    expect(s.player.bodyDamage + s.opponent.bodyDamage).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement** `resolveRound` with the model above and named initial constants (`IQ_FACTOR=0.1`, `SWING_RANGE=24`, `DMG_FACTOR`, `COUNTER_BONUS`, `BODY_TO_STAMINA`). Keep it a pure function returning a new state.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(combat): round resolution with stamina and scoring`.

---

### Task 8: Finish windows + pressure-decision finish sequence

**Files:**
- Create: `src/domain/combat/finish.ts`
- Modify: `src/domain/combat/resolve.ts` (open a window instead of silently advancing when triggered)
- Test: `src/domain/combat/finish.test.ts`

**Interfaces:**
- Consumes: `FightState`, `FinishWindow` from `./fightState`; `isGassed` from `./stamina`.
- Produces:
  - `ROCKED_HEAD_DMG(chin):number` — head-damage threshold to be "rocked" (scales with chin).
  - `detectWindow(state, resolvedContext):FinishWindow | null` — opens when EITHER the just-resolved round pushed a side's `headDamage ≥ ROCKED_HEAD_DMG` (damage path, method `KO`) OR a read landed: a clean `counter` that beat a `pressure`, a `grapple` submission attempt vs low `submissionDef`, or the opponent is gassed (read path; method `submission` for grapple reads, else `KO`).
  - `type FinishChoice = 'commit' | 'measure' | 'hold'`; `FINISH_CHOICES`.
  - `finishStep(state:FightState, choice:FinishChoice):FightState` — requires `phase==='finish-window'`; resolves one pressure decision via `createRng(\`${seed}#f${fightNumber}#finish${stepIndex}\`)`: `commit` = high finish probability but on failure the window closes (stamina cost, back to `in-round`); `measure`/`hold` = lower finish probability but preserves a step; when `stepsLeft` hits 0 the window closes. On success → `phase='finished'`, `outcome={ winner: window.side==='player'?'player':'opponent', method: window.method, round }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { startFight } from './fightState';
import { resolveRound } from './resolve';
import { finishStep } from './finish';
import { ARCHETYPES } from './archetypes';

// A fragile-chinned opponent so the damage path opens within a couple of rounds.
const GLASS = { id: 'g', name: 'Glass Joe', archetype: 'brawler' as const, statLine: { ...ARCHETYPES.brawler, chin: 20, strikingDef: 20 } };

describe('finish flow', () => {
  it('a rocked opponent opens a finish window, and commit can end it', () => {
    let s = startFight({ seed: 'ko-seed', fightNumber: 1, playerStatLine: { ...ARCHETYPES.brawler, striking: 99 }, opponent: GLASS });
    for (let i = 0; i < 3 && s.phase === 'in-round'; i++) {
      s = resolveRound(s, { where: 'strike', target: 'head', approach: 'pressure' });
    }
    expect(s.phase).toBe('finish-window');
    expect(s.window?.side).toBe('player');
    // drive the finish sequence to a terminal state
    while (s.phase === 'finish-window') s = finishStep(s, 'commit');
    expect(['finished','in-round']).toContain(s.phase);
    if (s.phase === 'finished') expect(s.outcome?.winner).toBe('player');
  });
  it('finishStep throws if no window is open', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: GLASS });
    expect(() => finishStep(s, 'commit')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement** `detectWindow`, wire it into `resolveRound` (set `phase='finish-window'` + `window` when detected, before the advance/decision logic), and implement `finishStep` with initial probabilities (`COMMIT_P=0.7`, `MEASURE_P=0.35`, `stepsLeft` initial 2–3). Both sides can be the window `side` (opponent can finish you).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(combat): finish windows + pressure-decision finish sequence`.

---

### Task 9: Opponent generation + difficulty scaling

**Files:**
- Create: `src/domain/combat/opponent.ts`
- Test: `src/domain/combat/opponent.test.ts`

**Interfaces:**
- Consumes: `STAT_IDS`, `clampStat`, `StatLine` from `./stats`; `ARCHETYPES`, `ARCHETYPE_IDS` from `./archetypes`; `createRng`, `pick` from `../rng`.
- Produces: `interface Opponent { id:string; name:string; archetype:ArchetypeId; statLine:StatLine }`; `targetRating(fightNumber):number` (smooth ramp); `generateOpponent(seed, fightNumber):Opponent` (deterministic; scales the archetype base toward `targetRating`; names from seeded name banks).

- [ ] **Step 1: Write the failing test** — assert a smooth, bounded ramp (no wall) and determinism:

```ts
import { describe, it, expect } from 'vitest';
import { generateOpponent, targetRating } from './opponent';

const avg = (l: Record<string, number>) => Object.values(l).reduce((a,b)=>a+b,0)/9;

describe('opponent scaling', () => {
  it('ramps smoothly and never maxes out (beatable ceiling)', () => {
    const ratings = [1,2,3,4,5,6,7,8,9,10].map((n) => targetRating(n));
    for (let i = 1; i < ratings.length; i++) expect(ratings[i]).toBeGreaterThanOrEqual(ratings[i-1]);
    expect(Math.max(...ratings)).toBeLessThanOrEqual(90); // headroom for a good player
    expect(ratings[9] - ratings[0]).toBeLessThanOrEqual(40); // no cliff
  });
  it('is deterministic and roughly hits the target rating', () => {
    const a = generateOpponent('s', 3), b = generateOpponent('s', 3);
    expect(a).toEqual(b);
    expect(Math.abs(avg(a.statLine) - targetRating(3))).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement** with `targetRating(n) = n<=4 ? 52 + n*4 : 68 + (n-4)*4` (initial; capped so late opponents stay beatable — tuned in Task 11) and the v1 `generateOpponent` scaling pattern adapted to v2 stats + name banks.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(combat): opponent generation + smooth difficulty scaling`.

---

### Task 10: Judges/decision + run flow (no rewards, fresh each fight)

**Files:**
- Create: `src/domain/combat/run.ts`
- Modify: `src/domain/combat/resolve.ts` (replace the TEMP decision fallback with the real judges call)
- Create: `src/domain/combat/judges.ts`
- Test: `src/domain/combat/judges.test.ts`, `src/domain/combat/run.test.ts`

**Interfaces:**
- Consumes: `FightState`, `startFight` from `./fightState`; `generateOpponent` from `./opponent`; `StatLine` from `./stats`.
- Produces:
  - `scoreFight(state):FightOutcome` (method `decision`) — winner by accumulated `roundScore`, `fightIQ` breaks ties.
  - `type RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'run-over'` (**no `reward` phase**).
  - `interface RunFighter { name:string; statLine:StatLine }`.
  - `interface RunState { seed; phase:RunPhase; fighter:RunFighter|null; fightNumber:number; record:{wins:number;losses:number}; isChampion:boolean; defenses:number; fight:FightState|null }` (**no `carriedDamage`**).
  - `startRun(seed)`, `applyDraft(run, fighter)`, `startNextFight(run)` (calls `startFight` with a freshly `generateOpponent`; **no carry-in damage**), `settleFight(run, fightState)` (win → `pre-fight`, `fightNumber+1`, belt at 5, `defenses` bump when already champ; loss → `run-over`; fails fast if the fight is unsettled — folds the M6/M7 `settleFight` guard).
  - `TITLE_FIGHT = 5`.

- [ ] **Step 1: Write `judges.test.ts`** — the side with more accumulated round score wins on the cards; ties break to higher fightIQ. Implement `scoreFight`.
- [ ] **Step 2: Wire `scoreFight` into `resolveRound`** — replace the TEMP fallback: at the last round with no finish window opened, set `phase='finished'` + `outcome = scoreFight(state)`.
- [ ] **Step 3: Write `run.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { startRun, applyDraft, startNextFight, settleFight, TITLE_FIGHT } from './run';
import { ARCHETYPES } from './archetypes';

const draftInto = () => applyDraft(startRun('run-seed'), { name: 'Champ', statLine: ARCHETYPES.allrounder });

describe('run flow (no rewards, fresh each fight)', () => {
  it('has no reward phase and no carriedDamage', () => {
    const r = startRun('s');
    expect(r.phase).toBe('drafting');
    expect('carriedDamage' in r).toBe(false);
  });
  it('a win advances straight to pre-fight and increments fightNumber', () => {
    let r = startNextFight(draftInto());
    const won = { ...r.fight!, phase: 'finished' as const, outcome: { winner: 'player' as const, method: 'KO' as const, round: 1 } };
    r = settleFight(r, won);
    expect(r.phase).toBe('pre-fight');
    expect(r.fightNumber).toBe(2);
  });
  it('winning fight 5 crowns the champion; a loss ends the run', () => {
    let r = { ...draftInto(), fightNumber: TITLE_FIGHT };
    r = startNextFight(r);
    r = settleFight(r, { ...r.fight!, phase: 'finished', outcome: { winner: 'player', method: 'decision', round: 5 } });
    expect(r.isChampion).toBe(true);
    let r2 = startNextFight(r);
    r2 = settleFight(r2, { ...r2.fight!, phase: 'finished', outcome: { winner: 'opponent', method: 'KO', round: 2 } });
    expect(r2.phase).toBe('run-over');
    expect(r2.record.losses).toBe(1);
  });
  it('settleFight throws on an unsettled fight', () => {
    const r = startNextFight(draftInto());
    expect(() => settleFight(r, r.fight!)).toThrow();
  });
});
```

- [ ] **Step 4: Implement** `run.ts` (mirror v1 `run.ts` minus rewards/carriedDamage; `startNextFight` generates a fresh opponent and calls `startFight`; `settleFight` fail-fast guard).
- [ ] **Step 5: Run all combat tests → PASS. Commit** — `feat(combat): judges decision + reward-free run flow`.

---

### Task 11: Barrel, full-run integration test, and balance tuning

**Files:**
- Create: `src/domain/combat/index.ts`, `src/domain/combat/integration.test.ts`, `src/domain/combat/balance.test.ts`
- Modify: any Task 3–9 constants as needed to satisfy the balance bands.

**Interfaces:**
- Produces: `src/domain/combat/index.ts` re-exporting the public surface (stats, intents, roster, draft, fightState, resolve, finish, opponent, run, judges).

- [ ] **Step 1: Barrel + a deterministic end-to-end run test** — draft a fighter, play several fights choosing intents, reach the title fight, record an outcome; assert the run reaches a terminal `run-over` and the whole thing is reproducible from the seed.

- [ ] **Step 2: Write the balance harness** (`balance.test.ts`) — a seeded simulator that plays many fights with a simple "good play" policy (attack the opponent's weakest defense, manage stamina, take finish windows) and a "careless" policy (always pressure, ignore stamina/defense), across `fightNumber` 1..10 and many seeds. Assert the success-criteria bands:

```ts
// Pseudocode of the assertions (implement the simulator concretely):
// 1. FINISHES ARE ATTAINABLE: with good play, finish rate across all fights is >= 25%
//    (finishes are clearly NOT rare — the v1 failure was ~0%).
// 2. EARLY DECISIONS MATTER: at fightNumber 1, careless play loses at least sometimes
//    (careless winRate < 100%) while good play wins the large majority (> 80%).
// 3. NO WALL: at fightNumber 9-10, good play still wins a meaningful share (>= 40%);
//    it is never 0% (the fight is always winnable with good play).
// 4. NO RUNAWAY: good-play winRate does not trend to 100% at high fightNumber
//    (curve stays a real challenge, not a snowball).
```

- [ ] **Step 3: Run the harness; TUNE** the constants from Tasks 3–9 (stamina costs/recovery, `effortMultiplier` floor, `SWING_RANGE`, `DMG_FACTOR`, `ROCKED_HEAD_DMG`, finish probabilities, `targetRating` curve) until all four bands pass. Re-run the full combat suite after each change to keep everything green.

- [ ] **Step 4: Final full run** — `npx vitest run && npx tsc --noEmit && npx vite build` all green. **Commit** — `test(combat): full-run integration + tuned balance bands`.

---

## What this milestone deliberately does NOT do (→ M8b, planned after merge)

- No changes to `App.tsx`, `src/screens/*`, or `src/components/*`. The new engine is not wired into the UI yet; the app still runs the v1 fight.
- No deletion of v1 domain files. (M8b deletes them at cutover.)
- No persistence changes. (M8b re-points `runStorage` at the v2 `RunState`; note the v2 blob shape differs — M8b will bump the storage version.)
- No Hub fix, no reward-screen removal. (M8b.)

## Self-Review

**Spec coverage (against `2026-07-02-v2-m8-combat-overhaul-design.md`):**
- §4 stat model → Task 1 (+ phase maps), Task 2 archetypes, Task 3 roster/build, Task 4 draft. ✓
- §5 round tactical sub-choices (where/target/approach) → Task 2 intents, Task 7 resolution. ✓
- §6 stamina (costs, recovery, gas) → Task 5, applied in Task 7. ✓
- §7 finish windows (damage OR read) + pressure-decision sequence → Task 8. ✓
- §8 judges fallback + round format → Task 6 `roundsForFight`, Task 10 `scoreFight`. ✓
- §9 run structure, rewards removed, fresh each fight, belt@5, permadeath, reign score → Task 10. ✓
- §10 difficulty fix (early decisions matter, no wall, no snowball) → Task 9 scaling + Task 11 balance bands. ✓
- §11 architecture (pure/seeded/tested, no deps, no Math.random) → Global Constraints + additive-only design. ✓
- §12 success criteria → Task 11 asserts finishes attainable (#2), decisions matter (#3), fair curve (#4); UI/persistence criteria (#1,#5,#6,#7) are M8b. ✓ (noted)
- §13 tuning knobs deferred → concentrated in Task 11. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". The one intentional temporary is Task 7's decision fallback, explicitly labelled `// TEMP` and replaced in Task 10. Constants are real initial values, tuned in Task 11 (called out in Global Constraints). ✓

**Type consistency:** `StatLine`, `RoundIntent{where,target,approach}`, `FightState`, `FinishWindow{side,method,stepsLeft}`, `FightOutcome{winner,method,round}`, `RunState` (no `carriedDamage`), `RunPhase` (no `reward`) are used identically across tasks. `startFight` takes `{seed,fightNumber,playerStatLine,opponent}`; `resolveRound(state,playerIntent)`; `finishStep(state,choice)`; `settleFight(run,fightState)`. ✓

**Green-per-task:** Tasks 1–11 are additive under `src/domain/combat/` and never import/modify v1, so `vitest`/`tsc`/`build` stay green at every commit. ✓
