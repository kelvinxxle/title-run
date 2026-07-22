import { startFight, resolveExchange, signatureReady, type FightState } from '../domain/combat';
import type { ExchangeMove } from '../domain/combat/intents';
import type { ResolvedBeat } from '../domain/combat/beat';

export function simulateFight(seed: string, script: ExchangeMove[]): { beats: ResolvedBeat[]; final: FightState } {
  const playerStatLine = { striking:85, strikingDef:75, takedowns:40, takedownDef:80, submissions:40, submissionDef:70, cardio:80, chin:75, fightIQ:80 };
  const opponent = { id: 'lab-opp', name: 'Lab Opponent', archetype: 'striker', statLine: { striking:55, strikingDef:55, takedowns:40, takedownDef:55, submissions:40, submissionDef:55, cardio:60, chin:60, fightIQ:55 } };
  let state = startFight({ seed, fightNumber: 1, playerStatLine, signatureId: 'the-left-hand', opponent });
  for (const move of script) {
    if (state.phase === 'finished') break;
    if (state.phase === 'corner') {
      state = { ...state, phase: 'in-round', gamePlan: null } as FightState;
    }
    if (state.phase === 'finish-window') break;
    if (state.phase === 'in-round') {
      if (move.kind === 'signature' && !signatureReady(state)) {
        console.warn('simulateFight: signature not ready, skipping');
        continue;
      }
      state = resolveExchange(state, move);
    }
  }
  return { beats: state.beats, final: state };
}
