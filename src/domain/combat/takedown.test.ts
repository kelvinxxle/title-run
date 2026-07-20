import { describe, it, expect } from 'vitest';
import { TAKEDOWN_PROFILES, TAKEDOWN_TYPES, opponentTakedownType } from './takedown';

describe('takedown profiles', () => {
  it('four types with the risk/reward ordering: easier shot → weaker landing position', () => {
    expect(TAKEDOWN_TYPES).toEqual(['single-leg', 'double-leg', 'trip', 'body-lock']);
    // higher atkMult = easier to land = weaker position quality
    expect(TAKEDOWN_PROFILES['single-leg'].atkMult).toBeGreaterThan(TAKEDOWN_PROFILES['body-lock'].atkMult);
    expect(TAKEDOWN_PROFILES['single-leg'].landsAt).toBe('guard');
    expect(TAKEDOWN_PROFILES['body-lock'].landsAt).toBe('mount');
    expect(TAKEDOWN_PROFILES['double-leg'].landsAt).toBe('half-guard');
    expect(TAKEDOWN_PROFILES['trip'].landsAt).toBe('side-control');
  });

  it('double-leg cost equals the retired flat takedown cost (17) — AI default is stamina-neutral vs M15', () => {
    expect(TAKEDOWN_PROFILES['double-leg'].cost).toBe(17);
  });

  it('opponentTakedownType is a pure, total map over archetypes', () => {
    expect(opponentTakedownType('wrestler')).toBe('double-leg');
    expect(opponentTakedownType('grappler')).toBe('trip');
    expect(opponentTakedownType('brawler')).toBe('single-leg');
    expect(opponentTakedownType('striker')).toBe('single-leg');
    expect(opponentTakedownType('allrounder')).toBe('double-leg');
  });
});
