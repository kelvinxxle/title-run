import { describe, it, expect } from 'vitest';
import { startFight, roundsForFight, opponentIntent } from './fightState';
import { ARCHETYPES } from './archetypes';

const OPP = { id: 'o1', name: 'Test Foe', archetype: 'wrestler' as const, statLine: ARCHETYPES.wrestler };

describe('fight state', () => {
  it('title fight and defenses are 5 rounds, others 3', () => {
    expect(roundsForFight(1)).toBe(3);
    expect(roundsForFight(5)).toBe(5);
    expect(roundsForFight(7)).toBe(5);
  });
  it('starts fresh: full stamina, zero damage, round 1, in-round', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(s.round).toBe(1);
    expect(s.phase).toBe('in-round');
    expect(s.player.headDamage).toBe(0);
    expect(s.player.stamina).toBe(100);
    expect(s.opponent.stamina).toBe(100);
    expect(s.outcome).toBeNull();
  });
  it('a wrestler AI prefers to wrestle and is deterministic', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(opponentIntent(s).kind).toBe('wrestle');
    expect(opponentIntent(s)).toEqual(opponentIntent(s));
  });
});
