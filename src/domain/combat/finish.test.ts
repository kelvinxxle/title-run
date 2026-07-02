import { describe, it, expect } from 'vitest';
import { startFight } from './fightState';
import { resolveRound } from './resolve';
import { finishStep } from './finish';
import { ARCHETYPES } from './archetypes';

// A fragile-chinned opponent so the damage path opens within a couple of rounds.
const GLASS = { id: 'g', name: 'Glass Joe', archetype: 'brawler' as const, statLine: { ...ARCHETYPES.brawler, chin: 20, strikingDef: 20 } };

describe('finish flow', () => {
  it('a rocked opponent opens a finish window, and commit can end it', () => {
    let s = startFight({ seed: 'ko-seed', fightNumber: 1, playerStatLine: { ...ARCHETYPES.brawler, striking: 99 }, opponent: GLASS });
    for (let i = 0; i < 3 && s.phase === 'in-round'; i++) {
      s = resolveRound(s, { where: 'strike', target: 'head', approach: 'pressure' });
    }
    expect(s.phase).toBe('finish-window');
    expect(s.window?.side).toBe('player');
    // drive the finish sequence to a terminal state
    while (s.phase === 'finish-window') s = finishStep(s, 'commit');
    expect(['finished','in-round']).toContain(s.phase);
    if (s.phase === 'finished') expect(s.outcome?.winner).toBe('player');
  });
  it('finishStep throws if no window is open', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: GLASS });
    expect(() => finishStep(s, 'commit')).toThrow();
  });
});
