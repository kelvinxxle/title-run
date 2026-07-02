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

  it('opponent-wins: player accrues body damage when oppIntent targets body (winner target drives damage type)', () => {
    // Player striking=1 vs opponent strikingDef=99: dominance is always << 0 (player always loses).
    // Player stamina=10 (<GAS_THRESHOLD 25) → opponentIntent() sets target='body'.
    // Player intent targets 'head' — buggy code (uses playerIntent.target) gives head damage;
    // correct code (uses oppIntent.target) gives body damage.
    const weakPlayer = { ...ARCHETYPES.striker, striking: 1 };
    const ironWall   = { id: 'o2', name: 'Iron', archetype: 'brawler' as const,
                         statLine: { ...ARCHETYPES.brawler, strikingDef: 99 } };
    const base   = startFight({ seed: 'test-body-target', fightNumber: 1,
                                 playerStatLine: weakPlayer, opponent: ironWall });
    const gassed = { ...base, player: { ...base.player, stamina: 10 } };
    const result = resolveRound(gassed, { where: 'strike', target: 'head', approach: 'technical' });
    // oppIntent.target must be 'body' (player is gassed) and player must lose
    expect(result.player.bodyDamage).toBeGreaterThan(0);
    expect(result.player.headDamage).toBe(0);
  });
});
