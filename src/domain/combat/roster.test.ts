import { describe, it, expect } from 'vitest';
import { STARTER_ROSTER, buildStatLine, rollFighter, getFighter, fighterIdByName } from './roster';
import { ARCHETYPE_IDS } from './archetypes';
import { STAT_IDS } from './stats';
import { createRng } from '../rng';

const avg = (f: (typeof STARTER_ROSTER)[number]) => {
  const line = buildStatLine(f);
  return STAT_IDS.reduce((s, k) => s + line[k], 0) / STAT_IDS.length;
};

describe('starter roster', () => {
  it('has 40 fighters with unique ids', () => {
    expect(STARTER_ROSTER).toHaveLength(40);
    const ids = STARTER_ROSTER.map((f) => f.id);
    expect(new Set(ids).size).toBe(40);
  });

  it('covers all five archetypes with at least six fighters each', () => {
    for (const arch of ARCHETYPE_IDS) {
      const count = STARTER_ROSTER.filter((f) => f.archetype === arch).length;
      expect(count).toBeGreaterThanOrEqual(6);
    }
    // every fighter has a known archetype
    for (const f of STARTER_ROSTER) expect(ARCHETYPE_IDS).toContain(f.archetype);
  });

  it('includes at least two deliberately-weak gatekeepers (avg < 60)', () => {
    const weak = STARTER_ROSTER.filter((f) => avg(f) < 60);
    expect(weak.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every built stat line within the 1..99 scale', () => {
    for (const f of STARTER_ROSTER) {
      const line = buildStatLine(f);
      for (const k of STAT_IDS) {
        expect(line[k]).toBeGreaterThanOrEqual(1);
        expect(line[k]).toBeLessThanOrEqual(99);
      }
    }
  });

  it('retains Georges St-Pierre by id (balance/integration harness depends on it)', () => {
    expect(() => getFighter('georges-st-pierre')).not.toThrow();
  });

  it('rollFighter is deterministic per seed and can exclude', () => {
    const a = rollFighter(createRng('s#0'));
    const b = rollFighter(createRng('s#0'));
    expect(a.id).toBe(b.id);
    const c = rollFighter(createRng('s#0'), [a.id]);
    expect(c.id).not.toBe(a.id);
  });

  it('supports a full 9-slot draft with no repeated source fighter', () => {
    // With 40 fighters the exclude-pool never exhausts before 9 rolls.
    let excluded: string[] = [];
    for (let i = 0; i < 9; i++) {
      const f = rollFighter(createRng(`draft#${i}`), excluded);
      expect(excluded).not.toContain(f.id);
      excluded = [...excluded, f.id];
    }
    expect(excluded.length).toBe(9);
  });
});

describe('fighterIdByName', () => {
  it('maps an exact roster name to its id', () => {
    expect(fighterIdByName('Jon Jones')).toBe('jon-jones');
  });
  it("handles apostrophes/accents", () => {
    expect(fighterIdByName("Sean O'Malley")).toBe('sean-omalley');
    expect(fighterIdByName('José Aldo')).toBe('jose-aldo');
  });
  it('returns undefined for a custom (player) name', () => {
    expect(fighterIdByName('Kid Dynamite McCustom')).toBeUndefined();
  });
});
