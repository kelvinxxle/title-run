import { describe, it, expect } from 'vitest';
import { startFight } from './fightState';
import { resolveRound } from './resolve';
import { ARCHETYPES } from './archetypes';

const OPP = { id: 'o', name: 'Foe', archetype: 'brawler' as const, statLine: ARCHETYPES.brawler };
const start = () => startFight({ seed: 'seed-42', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });

describe('resolveRound', () => {
  it('is deterministic for the same seed + intent', () => {
    const a = resolveRound(start(), { where:'strike', target:'head', approach:'technical' });
    const b = resolveRound(start(), { where:'strike', target:'head', approach:'technical' });
    expect(a).toEqual(b);
  });
  it('spends stamina (pressure spends more than counter over a round)', () => {
    const p = resolveRound(start(), { where:'strike', target:'head', approach:'pressure' });
    const c = resolveRound(start(), { where:'strike', target:'head', approach:'counter' });
    expect(p.player.stamina).toBeLessThan(c.player.stamina);
  });
  it('body targeting accumulates body damage on the loser side', () => {
    const s = resolveRound(start(), { where:'strike', target:'body', approach:'pressure' });
    expect(s.player.bodyDamage + s.opponent.bodyDamage).toBeGreaterThan(0);
  });
});
