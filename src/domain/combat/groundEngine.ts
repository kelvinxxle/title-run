import type { StatLine } from './stats';
import type { GroundPosition } from './ground';
import { POSITION_QUALITY, POSITION_SUBMISSION } from './ground';
import { groundAndPoundDamage, submissionTapProbability } from './finish';

export const GNP_POSITION_SCALE = 0.35;
export const SUB_POSITION_SCALE = 0.10;
export const SUB_POSITION_MALUS = 0.00;
export const SUB_GAS_BONUS = 0.10;
export const ADVANCE_BASE = 0.55;
export const ADVANCE_SCALE = 0.006;
export const ADVANCE_MIN = 0.15;
export const ADVANCE_MAX = 0.90;
export const ESCAPE_BASE = 0.30;
export const ESCAPE_SCALE = 0.006;
export const ESCAPE_MIN = 0.05;
export const ESCAPE_MAX = 0.60;

export const GND_POUND_COST = 6;
export const GND_ADVANCE_COST = 8;
export const GND_SUBFAIL_COST = 12;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function groundPoundDamage(attacker: StatLine, defender: StatLine, position: GroundPosition): number {
  const base = groundAndPoundDamage(attacker, defender);
  return Math.round(base * (1 + GNP_POSITION_SCALE * POSITION_QUALITY[position]));
}

export function groundSubProbability(
  attacker: StatLine, defender: StatLine, position: GroundPosition, defenderGassed: boolean,
): number {
  if (POSITION_SUBMISSION[position] === null) return 0;
  const q = POSITION_QUALITY[position];
  const p = submissionTapProbability(attacker, defender)
    + SUB_POSITION_SCALE * q
    - SUB_POSITION_MALUS
    + (defenderGassed ? SUB_GAS_BONUS : 0);
  return clamp(p, 0.05, 0.95);
}

export function advanceProbability(attacker: StatLine, defender: StatLine): number {
  return clamp(ADVANCE_BASE + (attacker.takedowns - defender.takedownDef) * ADVANCE_SCALE, ADVANCE_MIN, ADVANCE_MAX);
}

export function escapeProbability(attacker: StatLine, defender: StatLine): number {
  // attacker = TOP player; defender = BOTTOM opponent trying to get up.
  return clamp(ESCAPE_BASE + (defender.takedownDef - attacker.takedowns) * ESCAPE_SCALE, ESCAPE_MIN, ESCAPE_MAX);
}
