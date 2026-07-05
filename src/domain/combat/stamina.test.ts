import { describe, it, expect } from 'vitest';
import { staminaCost, recovery, isGassed, effortMultiplier, mobilityMultiplier, STAMINA_MAX } from './stamina';
import type { RoundIntent, StrikeTactic } from './intents';
import { ARCHETYPES } from './archetypes';

const strike = (tactic: StrikeTactic): RoundIntent => ({ kind: 'strike', target: 'head', tactic });
const wrestle: RoundIntent = { kind: 'wrestle' };

describe('stamina economy', () => {
  it('pressure costs more than pickApart, which costs more than counter', () => {
    expect(staminaCost(strike('pressure'))).toBeGreaterThan(staminaCost(strike('pickApart')));
    expect(staminaCost(strike('pickApart'))).toBeGreaterThan(staminaCost(strike('counter')));
  });
  it('a takedown shoot costs more than the priciest strike', () => {
    expect(staminaCost(wrestle)).toBeGreaterThan(staminaCost(strike('pressure')));
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

describe('mobilityMultiplier', () => {
  it('is 1.0 with no leg damage', () => { expect(mobilityMultiplier(0)).toBe(1); });
  it('decreases as leg damage rises', () => { expect(mobilityMultiplier(40)).toBeLessThan(mobilityMultiplier(10)); });
  it('never drops below the 0.7 floor', () => { expect(mobilityMultiplier(1000)).toBeGreaterThanOrEqual(0.7); });
});
