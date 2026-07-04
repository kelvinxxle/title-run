import { describe, it, expect } from 'vitest';
import { generateOpponent } from './opponent';
import { STARTER_ROSTER, buildStatLine, getFighter } from './roster';
import { STAT_IDS } from './stats';

// Compute tiers in test to mirror the in-code logic for verification
const rosterWithOverall = STARTER_ROSTER.map(f => ({
  f,
  overall: STAT_IDS.reduce((s, k) => s + buildStatLine(f)[k], 0) / STAT_IDS.length,
})).sort((a, b) => a.overall - b.overall);

const TIERS: typeof STARTER_ROSTER[number][][] = [];
for (let t = 0; t < 5; t++) {
  TIERS.push(rosterWithOverall.slice(t * 8, (t + 1) * 8).map(x => x.f));
}

const ROSTER_IDS = new Set(STARTER_ROSTER.map(f => f.id));

const TIER5_IDS = new Set(TIERS[4].map(f => f.id));

describe('T2 — real-fighter tiered ladder', () => {
  // Test 1: Returns a real fighter from STARTER_ROSTER
  it('returns a real fighter: valid id, name, archetype, statLine deep-equals buildStatLine', () => {
    for (const seed of ['test', 'abc', 'xyz']) {
      for (let n = 1; n <= 10; n++) {
        const opp = generateOpponent(seed, n);
        expect(ROSTER_IDS.has(opp.id), `id ${opp.id} not in roster (seed=${seed}, n=${n})`).toBe(true);
        const fighter = getFighter(opp.id);
        expect(opp.name).toBe(fighter.name);
        expect(opp.archetype).toBe(fighter.archetype);
        expect(opp.statLine).toEqual(buildStatLine(fighter));
      }
    }
  });

  // Test 2: Difficulty rises — fights 1-4 hit tiers 1-4 respectively
  it('difficulty rises: fight n (1-4) returns a fighter from tier n', () => {
    for (const seed of ['test', 'abc', 'xyz']) {
      for (let n = 1; n <= 4; n++) {
        const opp = generateOpponent(seed, n);
        const tierIds = new Set(TIERS[n - 1].map(f => f.id));
        expect(tierIds.has(opp.id), `fight ${n} with seed=${seed}: ${opp.id} not in tier ${n}`).toBe(true);
      }
    }
  });

  // Test 3: Fight 5 and all defenses (fights 6-12) return Tier-5 fighters
  it('champion at title + defenses: fights 5-12 return Tier-5 ids', () => {
    for (const seed of ['test', 'abc', 'xyz']) {
      for (let n = 5; n <= 12; n++) {
        const opp = generateOpponent(seed, n);
        expect(TIER5_IDS.has(opp.id), `fight ${n} seed=${seed}: ${opp.id} not in Tier 5`).toBe(true);
      }
    }
  });

  // Test 4: Dedup fights 1-5 — different tiers guarantee distinct ids
  it('dedup fights 1-5: all distinct opponent ids (different tiers)', () => {
    const seed = 's';
    const ids = [1, 2, 3, 4, 5].map(n => generateOpponent(seed, n).id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  // Test 5: Dedup fights 5-12 — 8 defenses cycle through all Tier-5 fighters uniquely
  it('dedup fights 5-12: all 8 defenses distinct; fight 13 starts a new permutation', () => {
    const seed = 'dedup-test';
    const ids5to12 = Array.from({ length: 8 }, (_, i) => generateOpponent(seed, 5 + i).id);
    // All 8 must be distinct (first full cycle of Tier 5)
    expect(new Set(ids5to12).size).toBe(8);
    // Fight 13 starts cycle 1, picks a valid Tier-5 fighter
    const id13 = generateOpponent(seed, 13).id;
    expect(TIER5_IDS.has(id13)).toBe(true);
  });

  // Test 6: Determinism — same seed+fight always yields identical result
  it('determinism: generateOpponent called twice yields identical result', () => {
    for (const seed of ['test', 'foo', 'bar']) {
      for (const n of [1, 3, 5, 8]) {
        const a = generateOpponent(seed, n);
        const b = generateOpponent(seed, n);
        expect(a).toEqual(b);
      }
    }
  });

  // Test 7: Jon Jones is reachable at Tier 5
  it('Jon Jones present: jon-jones appears in fights 5-12 with seed "test"', () => {
    // fight 10 with seed 'test' yields jon-jones (idx=5 in the champions permutation)
    const jonJonesFight = Array.from({ length: 8 }, (_, i) => generateOpponent('test', 5 + i));
    const found = jonJonesFight.some(opp => opp.id === 'jon-jones');
    expect(found, 'jon-jones should appear in fights 5-12 with seed "test"').toBe(true);
  });

  // Verification: computed tier composition matches plan §3 table (same fighter sets, any order)
  it('tier composition matches plan §3 pinned table (same fighter sets)', () => {
    // Plan §3 table — fighter sets (order within tier doesn't matter).
    // The plan correctly places demian-maia in Tier 2 (overall ~68.1) and
    // robert-whittaker in Tier 3 (overall ~69.1), computed from the actual
    // archetype base stats in archetypes.ts.
    const planTiers: string[][] = [
      // Tier 1 (plan: 44.9–63.1)
      ['rudy-kane', 'journeyman-doe', 'derrick-lewis', 'mark-hunt', 'francis-ngannou', 'robbie-lawler', 'conor-mcgregor', 'sean-omalley'],
      // Tier 2 (plan: 65.1–68.7)
      ['justin-gaethje', 'israel-adesanya', 'demian-maia', 'anderson-silva', 'charles-oliveira', 'max-holloway', 'jose-aldo', 'petr-yan'],
      // Tier 3 (plan: 68.9–73.8)
      ['chael-sonnen', 'robert-whittaker', 'frank-mir', 'fabricio-werdum', 'matt-hughes', 'ronaldo-souza', 'alexander-volkanovski', 'brian-ortega'],
      // Tier 4 (plan: 74–76.4)
      ['colby-covington', 'bj-penn', 'nate-diaz', 'cain-velasquez', 'henry-cejudo', 'tj-dillashaw', 'islam-makhachev', 'kamaru-usman'],
      // Tier 5 (plan: 76.7–84.7)
      ['khabib-nurmagomedov', 'daniel-cormier', 'leon-edwards', 'stipe-miocic', 'frankie-edgar', 'dominick-cruz', 'georges-st-pierre', 'jon-jones'],
    ];
    for (let t = 0; t < 5; t++) {
      const computedSet = new Set(TIERS[t].map(f => f.id));
      const planSet = new Set(planTiers[t]);
      expect(computedSet).toEqual(planSet);
    }
  });

  it('throws a clear error with /positive integer/ for fightNumber: 0', () => {
    expect(() => generateOpponent('seed', 0)).toThrow(/positive integer/);
  });

  it('throws a clear error with /positive integer/ for fightNumber: -1', () => {
    expect(() => generateOpponent('seed', -1)).toThrow(/positive integer/);
  });

  it('throws a clear error with /positive integer/ for fightNumber: 2.5', () => {
    expect(() => generateOpponent('seed', 2.5)).toThrow(/positive integer/);
  });
});
