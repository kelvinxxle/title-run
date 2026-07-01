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
