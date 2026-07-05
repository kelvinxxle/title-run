import type { StatLine } from './stats';
import type { RoundIntent, StrikeTactic } from './intents';

export const STAMINA_MAX = 100;
export const GAS_THRESHOLD = 25;

const STRIKE_BASE = 10;
const STRIKE_TACTIC_MULT: Record<StrikeTactic, number> = { pressure: 1.6, pickApart: 1.0, counter: 0.6 };
/** A takedown shoot is a whole-body commitment — meaningfully pricier than any single strike.
 *  The neutral pre-redesign cost was 16 (technical/1.0 row: round(16 * 1.0)); shipped at 17 —
 *  the least value that keeps all four balance bands green AND satisfies the pre-existing
 *  stamina.test invariant staminaCost(wrestle) > staminaCost(strike('pressure')) (pressure = 16).
 *  M10-authorized balance knob. */
const WRESTLE_COST = 17;

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

const MOBILITY_FLOOR = 0.7;
const MOBILITY_PER_DMG = 0.006; // ~0.30 lost by ~50 leg damage
export function mobilityMultiplier(legDamage: number): number {
  return Math.max(MOBILITY_FLOOR, 1 - Math.max(0, legDamage) * MOBILITY_PER_DMG);
}
