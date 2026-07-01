import { describe, it, expect } from 'vitest';
import { ROSTER, buildStatLine, createRng, rollFighter, STAT_IDS } from './index';
import * as domain from './index';

describe('domain barrel', () => {
  it('re-exports the domain surface', () => {
    expect(STAT_IDS).toHaveLength(9);
    const fighter = rollFighter(createRng('smoke'));
    expect(ROSTER).toContain(fighter);
    expect(Object.keys(buildStatLine(fighter))).toHaveLength(9);
  });
});

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
