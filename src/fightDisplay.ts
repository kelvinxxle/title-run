import { STAMINA_MAX, type Fighter2, type FightState } from './domain/combat';

export function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }

export function healthPct(fighter: Fighter2): number {
  const chin = Math.max(1, fighter.statLine.chin);
  return clamp01(1 - fighter.headDamage / chin);
}

export function staminaPct(fighter: Fighter2): number {
  return clamp01(fighter.stamina / STAMINA_MAX);
}

export function roundLabel(state: FightState): string {
  if (state.phase === 'finished') return 'Fight over';
  if (state.phase === 'finish-window') return `Finish window · Round ${state.round}`;
  return `Round ${state.round} of ${state.rounds}`;
}
