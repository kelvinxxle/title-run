import type { StatLine } from './stats';
import type { RoundIntent, StrikeTactic } from './intents';

export const STAMINA_MAX = 100;
export const GAS_THRESHOLD = 25;

const STRIKE_BASE = 10;
const STRIKE_TACTIC_MULT: Record<StrikeTactic, number> = { pressure: 1.6, pickApart: 1.0, counter: 0.6 };
/** A takedown shoot is a whole-body commitment — meaningfully pricier than any single strike. */
const WRESTLE_COST = 22;

export function startingStamina(_statLine: StatLine): number { return STAMINA_MAX; }

export function staminaCost(intent: RoundIntent): number {
  if (intent.kind === 'strike') {
    return Math.round(STRIKE_BASE * STRIKE_TACTIC_MULT[intent.tactic]);
  }
  return WRESTLE_COST;
}

export function recovery(statLine: StatLine): number {
  return Math.round(4 + statLine.cardio * 0.12); // ~13 at cardio 75
}
export function isGassed(stamina: number): boolean { return stamina < GAS_THRESHOLD; }
export function effortMultiplier(stamina: number): number {
  const t = Math.max(0, Math.min(1, stamina / STAMINA_MAX));
  return 0.6 + 0.4 * t; // 1.0 fresh → 0.6 empty
}
