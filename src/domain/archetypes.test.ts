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
