import { describe, it, expect } from 'vitest';
import { clamp01, healthPct, staminaPct, roundLabel } from './fightDisplay';
import { STAT_IDS, type Fighter2, type FightState, type StatLine } from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 60])) as StatLine;
const fighter = (over: Partial<Fighter2> = {}): Fighter2 => ({
  statLine: { ...LINE, chin: 50 },
  headDamage: 0, bodyDamage: 0, stamina: 100, roundScore: 0, ...over,
});

describe('fightDisplay', () => {
  it('clamp01 bounds to [0,1]', () => {
    expect(clamp01(-1)).toBe(0); expect(clamp01(2)).toBe(1); expect(clamp01(0.5)).toBe(0.5);
  });
  it('healthPct is 1 at zero head damage and falls as damage rises', () => {
    const f = fighter(); // chin 50
    expect(healthPct(f)).toBe(1);
    expect(healthPct({ ...f, headDamage: 25 })).toBeCloseTo(0.5, 5);
    expect(healthPct({ ...f, headDamage: 999 })).toBe(0);
  });
  it('staminaPct scales stamina against STAMINA_MAX', () => {
    expect(staminaPct(fighter({ stamina: 100 }))).toBe(1);
    expect(staminaPct(fighter({ stamina: 0 }))).toBe(0);
  });
  it('roundLabel reflects phase', () => {
    const base = fighter();
    const st = (phase: FightState['phase']): FightState => ({
      seed:'s', fightNumber:1, rounds:3, round:2, phase,
      player: base, opponent: { ...base, name:'R', archetype:'boxer' },
      window: null, outcome: null, log: [],
    });
    expect(roundLabel(st('in-round'))).toBe('Round 2 of 3');
    expect(roundLabel(st('finish-window'))).toContain('Finish');
    expect(roundLabel(st('finished'))).toBe('Fight over');
  });
});
