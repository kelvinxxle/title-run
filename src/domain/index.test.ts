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
