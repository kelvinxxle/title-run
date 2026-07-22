import { it, expect } from 'vitest';
import { startFight } from '../domain/combat/fightState';
import { resolveExchange } from '../domain/combat/exchange';
import { finishStep } from '../domain/combat/finish';
import { buildBeatTimeline } from './timeline';

it('I1 end-to-end — real KO finish emits isFinish=true beat and timeline renders knockdown', () => {
  // makeWindowState({ round:2 }) known to succeed (COMMIT_P analysis).
  // Use the GLASS opponent + high striking player to reliably reach finish-window.
  // Then drive finishStep with a seed that succeeds.
  const playerStatLine = {
    striking: 99, strikingDef: 70, takedowns: 40, takedownDef: 80,
    submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80,
  };
  const glass = {
    id: 'g', name: 'Glass Joe', archetype: 'brawler' as const,
    statLine: {
      striking: 20, strikingDef: 20, takedowns: 20, takedownDef: 30,
      submissions: 20, submissionDef: 30, cardio: 40, chin: 20, fightIQ: 40,
    },
  };

  // Find a seed + fight path that reaches finish-window and succeeds on commit
  for (let n = 1; n <= 50; n++) {
    const seed = `i1-e2e-${n}`;
    let s = startFight({ seed, fightNumber: 1, playerStatLine, opponent: glass });
    for (let i = 0; i < 15; i++) {
      if (s.phase === 'finish-window' && s.window?.side === 'player') {
        const after = finishStep(s, 'commit');
        if (after.phase === 'finished' && after.outcome?.winner === 'player') {
          const koBeats = after.beats.filter(b => b.isFinish);
          expect(koBeats.length).toBeGreaterThanOrEqual(1);
          const kb = koBeats[0];
          expect(kb.isFinish).toBe(true);
          expect(kb.finishMethod).toBe('KO');
          // Replay layer: timeline must include a knockdown event
          const { events } = buildBeatTimeline(kb, seed);
          expect(events.some(e => e.kind === 'knockdown' && e.pose === 'down')).toBe(true);
          return;
        }
        break; // failed commit, try next seed
      }
      if (s.phase === 'corner') s = { ...s, phase: 'in-round' as const, gamePlan: null };
      if (s.phase !== 'in-round') break;
      s = resolveExchange(s, { kind: 'strike', strike: 'powerPunch' });
    }
  }
  throw new Error('Could not reach a successful KO finish in 50 seeds');
});
