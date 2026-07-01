# Milestone 2 — Core Domain: Stats, RNG & Roster Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

Goal: Build the pure, deterministic domain foundation for Title Run — the 9-stat model, a seeded RNG, fighter archetypes, and a curated 36-fighter roster with query/roll functions — all fully unit-tested with zero React/DOM dependencies.

Architecture: A new src/domain/ layer holds pure TypeScript modules with no imports from React or the DOM. Fighters are represented compactly as an archetype (a shared baseline stat line) plus a per-fighter signature (a small set of overrides), and buildStatLine() merges them into a full 9-stat line. All randomness flows through an injectable seeded RNG so every behavior is reproducible and testable.

Tech Stack: TypeScript (strict), Vitest (already configured). No new dependencies.

## Global Constraints
- TypeScript strict mode; no any; no new runtime dependencies; no React/DOM imports anywhere in src/domain/.
- The domain layer is pure and deterministic: all randomness goes through the RNG from src/domain/rng.ts (never Math.random).
- The nine stat ids, in canonical order, are exactly: boxing, kicks, clinch, takedowns, submissions, topControl, cardio, chin, fightIQ.
- Stat values are integers in the inclusive range [1, 99].
- Tests are colocated as *.test.ts next to the module they test (matches the M1 convention, e.g. src/navigation/screens.test.ts).
- Follow M1 conventions: named exports; readonly/as const for static data; lookup helpers throw on a miss (see src/navigation/screens.ts getScreen).
- Every task ends green: `npm run test` and `npm run build` both pass, then a commit.
- No Vitest/Vite config changes are needed — the existing vite.config.ts picks up **/*.test.ts automatically.

## File Structure
- src/domain/stats.ts — Stat ids, labels, StatLine type, range constants, clampStat, isStatId.
- src/domain/rng.ts — Seeded PRNG (createRng) returning an Rng function, plus pure helpers randInt, pick, shuffle.
- src/domain/archetypes.ts — Archetype union and ARCHETYPES baseline stat lines.
- src/domain/roster.ts — Fighter type, the ROSTER data (36 fighters), buildStatLine, getFighter, rollFighter.
- src/domain/index.ts — Barrel re-exporting the domain surface.
- Each module has a colocated *.test.ts.

---

### Task 0: Commit the plan document
Create docs/superpowers/plans/2026-07-01-m2-core-domain.md containing this entire plan verbatim, then:
```bash
git add docs/superpowers/plans/2026-07-01-m2-core-domain.md
git commit -m "docs: add M2 core domain implementation plan"
```

---

### Task 1: Stat model
Files: Create src/domain/stats.ts; Test src/domain/stats.test.ts.
Produces: type StatId (9-member union); STAT_IDS: readonly StatId[]; STAT_LABELS: Record<StatId,string>; type StatLine = Record<StatId, number>; STAT_MIN=1; STAT_MAX=99; clampStat(value:number):number; isStatId(value:string):value is StatId.

Step 1 — write failing test src/domain/stats.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { STAT_IDS, STAT_LABELS, clampStat, isStatId, STAT_MIN, STAT_MAX } from './stats';

describe('stat model', () => {
  it('defines exactly the nine stats in canonical order', () => {
    expect(STAT_IDS).toEqual(['boxing','kicks','clinch','takedowns','submissions','topControl','cardio','chin','fightIQ']);
  });
  it('labels every stat with a display name', () => {
    expect(STAT_IDS.every((id) => typeof STAT_LABELS[id] === 'string' && STAT_LABELS[id].length > 0)).toBe(true);
    expect(STAT_LABELS.topControl).toBe('Top Control');
    expect(STAT_LABELS.fightIQ).toBe('Fight IQ');
  });
  it('clamps values into [1,99] and rounds to integers', () => {
    expect(clampStat(0)).toBe(STAT_MIN);
    expect(clampStat(150)).toBe(STAT_MAX);
    expect(clampStat(50)).toBe(50);
    expect(clampStat(50.7)).toBe(51);
  });
  it('recognises valid stat ids', () => {
    expect(isStatId('boxing')).toBe(true);
    expect(isStatId('wingspan')).toBe(false);
  });
});
```
Step 2 — run `npx vitest run src/domain/stats.test.ts`, expect FAIL (cannot resolve ./stats).
Step 3 — implement src/domain/stats.ts:
```ts
export type StatId = 'boxing' | 'kicks' | 'clinch' | 'takedowns' | 'submissions' | 'topControl' | 'cardio' | 'chin' | 'fightIQ';

export const STAT_IDS: readonly StatId[] = ['boxing','kicks','clinch','takedowns','submissions','topControl','cardio','chin','fightIQ'] as const;

export const STAT_LABELS: Record<StatId, string> = {
  boxing: 'Boxing', kicks: 'Kicks', clinch: 'Clinch', takedowns: 'Takedowns', submissions: 'Submissions', topControl: 'Top Control', cardio: 'Cardio', chin: 'Chin', fightIQ: 'Fight IQ',
};

export type StatLine = Record<StatId, number>;

export const STAT_MIN = 1;
export const STAT_MAX = 99;

export function clampStat(value: number): number {
  return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(value)));
}

export function isStatId(value: string): value is StatId {
  return (STAT_IDS as readonly string[]).includes(value);
}
```
Step 4 — run test, expect PASS (4). Step 5 — `npm run build`. Step 6 — commit:
```bash
git add src/domain/stats.ts src/domain/stats.test.ts
git commit -m "feat(domain): add nine-stat model with clamp and guards"
```

---

### Task 2: Seeded RNG
Files: Create src/domain/rng.ts; Test src/domain/rng.test.ts.
Produces: type Rng = () => number; createRng(seed: string|number): Rng; randInt(rng,min,max) inclusive; pick<T>(rng, items: readonly T[]): T (throws on empty); shuffle<T>(rng, items: readonly T[]): T[] (new array, no mutation).
Expected float sequences were computed from THIS exact xmur3+mulberry32 impl; use toBeCloseTo(value,9) for floats.

Step 1 — write failing test src/domain/rng.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { createRng, randInt, pick, shuffle } from './rng';

describe('seeded rng', () => {
  it('produces a deterministic sequence for a string seed', () => {
    const rng = createRng('title-run');
    const seq = [rng(), rng(), rng(), rng(), rng()];
    expect(seq[0]).toBeCloseTo(0.882116372, 9);
    expect(seq[1]).toBeCloseTo(0.4596152566, 9);
    expect(seq[2]).toBeCloseTo(0.3886326398, 9);
    expect(seq[3]).toBeCloseTo(0.9923890054, 9);
    expect(seq[4]).toBeCloseTo(0.5112489781, 9);
  });
  it('is reproducible: same seed yields the same sequence', () => {
    const a = createRng('title-run');
    const b = createRng('title-run');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('supports numeric seeds', () => {
    const rng = createRng(42);
    expect(rng()).toBeCloseTo(0.1682699858, 9);
  });
  it('returns integers within an inclusive range', () => {
    const rng = createRng('dice');
    const rolls = Array.from({ length: 10 }, () => randInt(rng, 1, 6));
    expect(rolls).toEqual([3, 5, 4, 3, 6, 5, 3, 1, 6, 3]);
    expect(rolls.every((n) => n >= 1 && n <= 6)).toBe(true);
  });
  it('picks deterministically and never mutates the source', () => {
    const rng = createRng('pick');
    const items = ['a', 'b', 'c', 'd'] as const;
    const picks = Array.from({ length: 8 }, () => pick(rng, items));
    expect(picks).toEqual(['d', 'b', 'a', 'b', 'a', 'a', 'd', 'c']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
  it('throws when picking from an empty array', () => {
    const rng = createRng('x');
    expect(() => pick(rng, [])).toThrow();
  });
  it('shuffles into a permutation without mutating the source', () => {
    const rng = createRng('shuffle');
    const items = [1, 2, 3, 4, 5];
    const out = shuffle(rng, items);
    expect(out).toHaveLength(5);
    expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});
```
Step 2 — run, expect FAIL. Step 3 — implement src/domain/rng.ts:
```ts
export type Rng = () => number;

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string | number): Rng {
  return mulberry32(xmur3(String(seed))());
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick: cannot choose from an empty array');
  }
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```
Step 4 — run test, expect PASS (7). Step 5 — `npm run build`. Step 6 — commit:
```bash
git add src/domain/rng.ts src/domain/rng.test.ts
git commit -m "feat(domain): add seeded deterministic RNG with helpers"
```

---

### Task 3: Fighter archetypes
Files: Create src/domain/archetypes.ts; Test src/domain/archetypes.test.ts.
Consumes: StatLine, STAT_IDS, STAT_MIN, STAT_MAX from ./stats.
Produces: type Archetype = 'striker'|'grappler'|'wrestler'|'brawler'|'allrounder'; ARCHETYPES: Record<Archetype, StatLine>; ARCHETYPE_IDS: Archetype[].

Step 1 — write failing test src/domain/archetypes.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import { STAT_IDS, STAT_MIN, STAT_MAX } from './stats';

describe('archetypes', () => {
  it('defines a full nine-stat baseline for every archetype', () => {
    for (const id of ARCHETYPE_IDS) {
      const line = ARCHETYPES[id];
      for (const stat of STAT_IDS) {
        expect(typeof line[stat]).toBe('number');
        expect(line[stat]).toBeGreaterThanOrEqual(STAT_MIN);
        expect(line[stat]).toBeLessThanOrEqual(STAT_MAX);
      }
    }
  });
  it('gives each archetype a signature strength', () => {
    expect(ARCHETYPES.striker.boxing).toBeGreaterThan(ARCHETYPES.striker.takedowns);
    expect(ARCHETYPES.grappler.submissions).toBeGreaterThan(ARCHETYPES.grappler.boxing);
    expect(ARCHETYPES.wrestler.takedowns).toBeGreaterThan(ARCHETYPES.wrestler.submissions);
    expect(ARCHETYPES.brawler.chin).toBeGreaterThan(ARCHETYPES.brawler.cardio);
  });
});
```
Step 2 — run, expect FAIL. Step 3 — implement src/domain/archetypes.ts:
```ts
import type { StatLine } from './stats';

export type Archetype = 'striker' | 'grappler' | 'wrestler' | 'brawler' | 'allrounder';

export const ARCHETYPES: Record<Archetype, StatLine> = {
  striker: { boxing: 78, kicks: 76, clinch: 58, takedowns: 40, submissions: 38, topControl: 42, cardio: 62, chin: 60, fightIQ: 64 },
  grappler: { boxing: 52, kicks: 50, clinch: 66, takedowns: 74, submissions: 82, topControl: 80, cardio: 64, chin: 60, fightIQ: 70 },
  wrestler: { boxing: 60, kicks: 54, clinch: 72, takedowns: 84, submissions: 56, topControl: 80, cardio: 74, chin: 66, fightIQ: 66 },
  brawler: { boxing: 80, kicks: 66, clinch: 56, takedowns: 44, submissions: 40, topControl: 46, cardio: 52, chin: 82, fightIQ: 52 },
  allrounder: { boxing: 72, kicks: 70, clinch: 66, takedowns: 66, submissions: 64, topControl: 66, cardio: 74, chin: 68, fightIQ: 78 },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as Archetype[];
```
Step 4 — run test, expect PASS (2). Step 5 — `npm run build`. Step 6 — commit:
```bash
git add src/domain/archetypes.ts src/domain/archetypes.test.ts
git commit -m "feat(domain): add fighter archetype baselines"
```

---

### Task 4: Fighter roster & queries
Files: Create src/domain/roster.ts; Test src/domain/roster.test.ts.
Consumes: STAT_IDS, clampStat, StatLine from ./stats; ARCHETYPES, Archetype, ARCHETYPE_IDS from ./archetypes; pick, Rng from ./rng; createRng from ./rng (in test); isStatId from ./stats (in test).
Produces: type WeightClass; type Division='M'|'W'; interface Fighter { id; name; weightClass; division; archetype; signature: Partial<StatLine> }; ROSTER: readonly Fighter[]; buildStatLine(fighter): StatLine; getFighter(id): Fighter (throws); rollFighter(rng, excludeIds?: readonly string[]): Fighter.
Data note: roster curated so EVERY stat has >=3 fighters at >=85. Roll vectors computed against this exact ROSTER ordering.

Step 1 — write failing test src/domain/roster.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { ROSTER, buildStatLine, getFighter, rollFighter } from './roster';
import { STAT_IDS, STAT_MIN, STAT_MAX, isStatId } from './stats';
import { ARCHETYPE_IDS } from './archetypes';
import { createRng } from './rng';

describe('roster', () => {
  it('curates between 30 and 40 fighters', () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(30);
    expect(ROSTER.length).toBeLessThanOrEqual(40);
  });
  it('has unique ids and unique names', () => {
    expect(new Set(ROSTER.map((f) => f.id)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.map((f) => f.name)).size).toBe(ROSTER.length);
  });
  it('uses only known archetypes and valid signature keys', () => {
    for (const f of ROSTER) {
      expect(ARCHETYPE_IDS).toContain(f.archetype);
      for (const key of Object.keys(f.signature)) {
        expect(isStatId(key)).toBe(true);
      }
    }
  });
  it('builds a full, in-range, integer nine-stat line for every fighter', () => {
    for (const f of ROSTER) {
      const line = buildStatLine(f);
      expect(Object.keys(line)).toHaveLength(9);
      for (const stat of STAT_IDS) {
        expect(line[stat]).toBeGreaterThanOrEqual(STAT_MIN);
        expect(line[stat]).toBeLessThanOrEqual(STAT_MAX);
        expect(Number.isInteger(line[stat])).toBe(true);
      }
    }
  });
  it('applies signature overrides on top of the archetype baseline', () => {
    const conor = getFighter('conor-mcgregor');
    expect(buildStatLine(conor).boxing).toBe(93);
    expect(buildStatLine(conor).takedowns).toBe(40);
  });
  it('offers at least three elite (>=85) options for every stat', () => {
    for (const stat of STAT_IDS) {
      const elite = ROSTER.filter((f) => buildStatLine(f)[stat] >= 85).length;
      expect(elite).toBeGreaterThanOrEqual(3);
    }
  });
  it('getFighter throws on an unknown id', () => {
    expect(() => getFighter('nobody')).toThrow();
  });
  it('rolls a deterministic fighter for a given seed', () => {
    expect(rollFighter(createRng('title-run')).id).toBe('michael-chandler');
  });
  it('excludes already-drafted fighters', () => {
    const first = rollFighter(createRng('title-run')).id;
    const second = rollFighter(createRng('title-run'), [first]).id;
    expect(second).toBe('leon-edwards');
    expect(second).not.toBe(first);
  });
  it('rolls a deterministic sequence from one rng', () => {
    const rng = createRng('draft-1');
    expect([rollFighter(rng).id, rollFighter(rng).id, rollFighter(rng).id]).toEqual(['daniel-cormier','demian-maia','conor-mcgregor']);
  });
});
```
Step 2 — run, expect FAIL. Step 3 — implement src/domain/roster.ts:
```ts
import { STAT_IDS, clampStat, type StatLine } from './stats';
import { ARCHETYPES, type Archetype } from './archetypes';
import { pick, type Rng } from './rng';

export type WeightClass = 'Strawweight' | 'Flyweight' | 'Bantamweight' | 'Featherweight' | 'Lightweight' | 'Welterweight' | 'Middleweight' | 'Light Heavyweight' | 'Heavyweight';

export type Division = 'M' | 'W';

export interface Fighter {
  id: string;
  name: string;
  weightClass: WeightClass;
  division: Division;
  archetype: Archetype;
  signature: Partial<StatLine>;
}

export const ROSTER: readonly Fighter[] = [
  { id: 'conor-mcgregor', name: 'Conor McGregor', weightClass: 'Featherweight', division: 'M', archetype: 'striker', signature: { boxing: 93, fightIQ: 78, cardio: 52 } },
  { id: 'israel-adesanya', name: 'Israel Adesanya', weightClass: 'Middleweight', division: 'M', archetype: 'striker', signature: { kicks: 94, clinch: 74, fightIQ: 82, chin: 70 } },
  { id: 'max-holloway', name: 'Max Holloway', weightClass: 'Featherweight', division: 'M', archetype: 'striker', signature: { boxing: 90, cardio: 92, chin: 80 } },
  { id: 'khabib-nurmagomedov', name: 'Khabib Nurmagomedov', weightClass: 'Lightweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 98, topControl: 96, cardio: 88, fightIQ: 88 } },
  { id: 'georges-st-pierre', name: 'Georges St-Pierre', weightClass: 'Welterweight', division: 'M', archetype: 'allrounder', signature: { takedowns: 90, fightIQ: 95, cardio: 88 } },
  { id: 'demetrious-johnson', name: 'Demetrious Johnson', weightClass: 'Flyweight', division: 'M', archetype: 'allrounder', signature: { fightIQ: 96, cardio: 90, submissions: 82, takedowns: 82 } },
  { id: 'jon-jones', name: 'Jon Jones', weightClass: 'Light Heavyweight', division: 'M', archetype: 'allrounder', signature: { clinch: 92, fightIQ: 94, kicks: 82, takedowns: 80 } },
  { id: 'charles-oliveira', name: 'Charles Oliveira', weightClass: 'Lightweight', division: 'M', archetype: 'grappler', signature: { submissions: 97, kicks: 78, chin: 58 } },
  { id: 'demian-maia', name: 'Demian Maia', weightClass: 'Welterweight', division: 'M', archetype: 'grappler', signature: { submissions: 96, topControl: 92, takedowns: 84, boxing: 44 } },
  { id: 'amanda-nunes', name: 'Amanda Nunes', weightClass: 'Bantamweight', division: 'W', archetype: 'brawler', signature: { boxing: 92, chin: 84, takedowns: 74 } },
  { id: 'valentina-shevchenko', name: 'Valentina Shevchenko', weightClass: 'Flyweight', division: 'W', archetype: 'allrounder', signature: { kicks: 90, fightIQ: 90, clinch: 80 } },
  { id: 'kamaru-usman', name: 'Kamaru Usman', weightClass: 'Welterweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 88, boxing: 82, cardio: 86, topControl: 86, clinch: 86 } },
  { id: 'francis-ngannou', name: 'Francis Ngannou', weightClass: 'Heavyweight', division: 'M', archetype: 'brawler', signature: { boxing: 96, chin: 78, cardio: 50, fightIQ: 56 } },
  { id: 'stipe-miocic', name: 'Stipe Miocic', weightClass: 'Heavyweight', division: 'M', archetype: 'allrounder', signature: { boxing: 84, cardio: 84, fightIQ: 82, chin: 82 } },
  { id: 'daniel-cormier', name: 'Daniel Cormier', weightClass: 'Heavyweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 90, topControl: 88, clinch: 86, chin: 80 } },
  { id: 'tony-ferguson', name: 'Tony Ferguson', weightClass: 'Lightweight', division: 'M', archetype: 'grappler', signature: { submissions: 88, cardio: 90, chin: 86, kicks: 80 } },
  { id: 'dustin-poirier', name: 'Dustin Poirier', weightClass: 'Lightweight', division: 'M', archetype: 'brawler', signature: { boxing: 90, clinch: 78, cardio: 80, chin: 78 } },
  { id: 'justin-gaethje', name: 'Justin Gaethje', weightClass: 'Lightweight', division: 'M', archetype: 'brawler', signature: { kicks: 90, boxing: 86, chin: 88, cardio: 78 } },
  { id: 'robert-whittaker', name: 'Robert Whittaker', weightClass: 'Middleweight', division: 'M', archetype: 'allrounder', signature: { boxing: 86, cardio: 86, chin: 82, fightIQ: 82 } },
  { id: 'alexander-volkanovski', name: 'Alexander Volkanovski', weightClass: 'Featherweight', division: 'M', archetype: 'allrounder', signature: { cardio: 92, fightIQ: 90, kicks: 82, chin: 82 } },
  { id: 'petr-yan', name: 'Petr Yan', weightClass: 'Bantamweight', division: 'M', archetype: 'striker', signature: { boxing: 88, fightIQ: 84, clinch: 80, cardio: 82 } },
  { id: 'sean-omalley', name: "Sean O'Malley", weightClass: 'Bantamweight', division: 'M', archetype: 'striker', signature: { kicks: 88, boxing: 84, chin: 56 } },
  { id: 'jose-aldo', name: 'Jose Aldo', weightClass: 'Featherweight', division: 'M', archetype: 'striker', signature: { kicks: 92, boxing: 84, takedowns: 72, chin: 80 } },
  { id: 'anderson-silva', name: 'Anderson Silva', weightClass: 'Middleweight', division: 'M', archetype: 'striker', signature: { kicks: 92, clinch: 88, fightIQ: 90, chin: 66 } },
  { id: 'jan-blachowicz', name: 'Jan Blachowicz', weightClass: 'Light Heavyweight', division: 'M', archetype: 'brawler', signature: { boxing: 84, chin: 88, kicks: 78 } },
  { id: 'rose-namajunas', name: 'Rose Namajunas', weightClass: 'Strawweight', division: 'W', archetype: 'striker', signature: { boxing: 82, fightIQ: 82, kicks: 80 } },
  { id: 'zhang-weili', name: 'Zhang Weili', weightClass: 'Strawweight', division: 'W', archetype: 'allrounder', signature: { boxing: 84, cardio: 88, takedowns: 78, chin: 80 } },
  { id: 'brandon-moreno', name: 'Brandon Moreno', weightClass: 'Flyweight', division: 'M', archetype: 'grappler', signature: { submissions: 86, cardio: 88, chin: 82 } },
  { id: 'aljamain-sterling', name: 'Aljamain Sterling', weightClass: 'Bantamweight', division: 'M', archetype: 'grappler', signature: { takedowns: 86, submissions: 86, cardio: 86 } },
  { id: 'colby-covington', name: 'Colby Covington', weightClass: 'Welterweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 86, cardio: 92, topControl: 82 } },
  { id: 'leon-edwards', name: 'Leon Edwards', weightClass: 'Welterweight', division: 'M', archetype: 'allrounder', signature: { kicks: 84, fightIQ: 82, cardio: 82 } },
  { id: 'michael-chandler', name: 'Michael Chandler', weightClass: 'Lightweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 84, boxing: 80, chin: 80, cardio: 76 } },
  { id: 'nate-diaz', name: 'Nate Diaz', weightClass: 'Welterweight', division: 'M', archetype: 'grappler', signature: { submissions: 84, cardio: 90, chin: 88, boxing: 78 } },
  { id: 'cain-velasquez', name: 'Cain Velasquez', weightClass: 'Heavyweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 88, cardio: 92, topControl: 86 } },
  { id: 'tj-dillashaw', name: 'TJ Dillashaw', weightClass: 'Bantamweight', division: 'M', archetype: 'striker', signature: { kicks: 84, fightIQ: 82, clinch: 78, cardio: 82 } },
  { id: 'henry-cejudo', name: 'Henry Cejudo', weightClass: 'Bantamweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 90, fightIQ: 86, clinch: 80 } },
];

export function buildStatLine(fighter: Fighter): StatLine {
  const base = ARCHETYPES[fighter.archetype];
  const line = {} as StatLine;
  for (const stat of STAT_IDS) {
    const raw = fighter.signature[stat] ?? base[stat];
    line[stat] = clampStat(raw);
  }
  return line;
}

export function getFighter(id: string): Fighter {
  const fighter = ROSTER.find((f) => f.id === id);
  if (!fighter) {
    throw new Error(`Unknown fighter id: ${id}`);
  }
  return fighter;
}

export function rollFighter(rng: Rng, excludeIds: readonly string[] = []): Fighter {
  const pool = ROSTER.filter((f) => !excludeIds.includes(f.id));
  return pick(rng, pool.length > 0 ? pool : ROSTER);
}
```
Step 4 — run test, expect PASS (10). If the elite-options assertion fails, do NOT weaken the test — adjust a fighter's signature so the affected stat has >=3 fighters at >=85, and note it in your report. Step 5 — `npm run build`. Step 6 — commit:
```bash
git add src/domain/roster.ts src/domain/roster.test.ts
git commit -m "feat(domain): add curated fighter roster with stat-line builder and roll"
```

---

### Task 5: Domain barrel export
Files: Create src/domain/index.ts; Test src/domain/index.test.ts.
Step 1 — write failing test src/domain/index.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { ROSTER, buildStatLine, createRng, rollFighter, STAT_IDS } from './index';

describe('domain barrel', () => {
  it('re-exports the domain surface', () => {
    expect(STAT_IDS).toHaveLength(9);
    const fighter = rollFighter(createRng('smoke'));
    expect(ROSTER).toContain(fighter);
    expect(Object.keys(buildStatLine(fighter))).toHaveLength(9);
  });
});
```
Step 2 — run, expect FAIL. Step 3 — implement src/domain/index.ts:
```ts
export * from './stats';
export * from './archetypes';
export * from './rng';
export * from './roster';
```
Step 4 — run FULL suite + build: `npm run test && npm run build` — expect ALL green (M1 + M2). Step 5 — commit:
```bash
git add src/domain/index.ts src/domain/index.test.ts
git commit -m "feat(domain): add domain barrel export"
```

---

## Definition of Done
- src/domain/ contains stats.ts, rng.ts, archetypes.ts, roster.ts, index.ts, each with a colocated passing test.
- Full suite green (M1 + M2), typecheck clean, npm run build succeeds.
- Roster: 36 fighters, unique ids/names, every fighter yields a full in-range integer 9-stat line, every stat has >=3 elite (>=85) options.
- RNG deterministic and reproducible; no Math.random in the domain.
- Branch pushed; PR opened into main; NOT merged.
