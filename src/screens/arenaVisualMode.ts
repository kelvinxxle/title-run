import type { FightPhase } from '../domain/combat/fightState';
import type { ResolvedBeat } from '../domain/combat/beat';

export type VisualMode = 'mat' | 'active-playback' | 'ko-down' | 'standing-idle';

export function arenaVisualMode(
  phase: FightPhase,
  isPlaying: boolean,
  currentBeat: ResolvedBeat | null,
): VisualMode {
  if (phase === 'ground') return 'mat';
  if (isPlaying) return 'active-playback';
  if (currentBeat?.isFinish) return 'ko-down';
  return 'standing-idle';
}
