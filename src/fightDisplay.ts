import { STAMINA_MAX, type Fighter2, type FightState } from './domain/combat';
import { ROCKED_HEAD_DMG } from './domain/combat/finish';
import { isGassed } from './domain/combat/stamina';

// Display-only cap; NOT a balance knob — do not use in engine math
const BODY_DISPLAY_CAP = 50;

export function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }

export function healthPct(fighter: Fighter2): number {
  const chin = Math.max(1, fighter.statLine.chin);
  return clamp01(1 - fighter.headDamage / chin);
}

export function bodyPct(fighter: Fighter2): number {
  return clamp01(1 - fighter.bodyDamage / BODY_DISPLAY_CAP);
}

export function headState(fighter: Fighter2): 'fresh' | 'hurt' | 'rocked' {
  const rockedThreshold = ROCKED_HEAD_DMG(Math.max(1, fighter.statLine.chin));
  if (fighter.headDamage >= rockedThreshold) return 'rocked';
  if (fighter.headDamage >= 0.6 * rockedThreshold) return 'hurt';
  return 'fresh';
}

export function gasState(stamina: number): 'ok' | 'low' {
  return isGassed(stamina) ? 'low' : 'ok';
}

export function staminaPct(fighter: Fighter2): number {
  return clamp01(fighter.stamina / STAMINA_MAX);
}

export function roundLabel(state: FightState): string {
  if (state.phase === 'finished') return 'Fight over';
  if (state.phase === 'finish-window') return `Finish window · Round ${state.round}`;
  if (state.phase === 'ground-window') return `Top control · Round ${state.round}`;
  if (state.phase === 'corner') return `Corner · After round ${state.round - 1}`;
  return `Round ${state.round} of ${state.rounds}`;
}
