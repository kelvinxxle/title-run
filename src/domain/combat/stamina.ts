import type { StatLine } from './stats';
import type { Where, Approach } from './intents';

export const STAMINA_MAX = 100;
export const GAS_THRESHOLD = 25;

const WHERE_COST: Record<Where, number> = { strike: 10, wrestle: 16, grapple: 14 };
const APPROACH_MULT: Record<Approach, number> = { pressure: 1.6, technical: 1.0, counter: 0.6 };

export function startingStamina(_statLine: StatLine): number { return STAMINA_MAX; }
export function staminaCost(where: Where, approach: Approach): number {
  return Math.round(WHERE_COST[where] * APPROACH_MULT[approach]);
}
export function recovery(statLine: StatLine): number {
  return Math.round(4 + statLine.cardio * 0.12); // ~13 at cardio 75
}
export function isGassed(stamina: number): boolean { return stamina < GAS_THRESHOLD; }
export function effortMultiplier(stamina: number): number {
  const t = Math.max(0, Math.min(1, stamina / STAMINA_MAX));
  return 0.6 + 0.4 * t; // 1.0 fresh → 0.6 empty
}
