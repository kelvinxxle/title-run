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
