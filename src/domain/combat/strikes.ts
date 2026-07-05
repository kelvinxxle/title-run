export type StrikeId = 'jab' | 'powerPunch' | 'bodyKick' | 'legKick' | 'knee' | 'elbow';
export type StrikeTarget = 'head' | 'body' | 'legs';

export interface StrikeProfile {
  id: StrikeId;
  label: string;
  blurb: string;
  target: StrikeTarget;
  /** Offensive multiplier on the attacker's striking score. */
  atkMult: number;
  /** Defensive exposure carried WHILE throwing this strike (lower = more open). */
  defMult: number;
  /** Damage weight applied to |dominance| when this strike lands. */
  power: number;
  /** Per-beat stamina charged to throw it. */
  staminaCost: number;
  /** Head-KO potential contribution (also flags head-hunting for the adaptive AI). */
  koWeight: number;
  /** 0..1 — higher = faster; fast strikes read/counter slow, high-commit strikes. */
  speed: number;
}

// Starting values — TUNED IN TASK 7. Keep the skill-separation intent: jab = safe/low,
// powerPunch = swingy/high, kicks add target variety, elbow = sharp short-range KO threat.
export const STRIKES: Record<StrikeId, StrikeProfile> = {
  jab:        { id: 'jab',        label: 'Jab',         blurb: 'Fast, safe, points.',          target: 'head', atkMult: 0.90, defMult: 1.15, power: 0.80, staminaCost: 6,  koWeight: 0.4, speed: 0.90 },
  powerPunch: { id: 'powerPunch', label: 'Power Punch', blurb: 'Swing for the KO — you commit.', target: 'head', atkMult: 1.35, defMult: 0.80, power: 1.25, staminaCost: 14, koWeight: 1.3, speed: 0.20 },
  bodyKick:   { id: 'bodyKick',   label: 'Body Kick',   blurb: 'Dig to the ribs, drain his gas.', target: 'body', atkMult: 1.15, defMult: 0.90, power: 1.10, staminaCost: 12, koWeight: 0.2, speed: 0.40 },
  legKick:    { id: 'legKick',    label: 'Leg Kick',    blurb: 'Chop the lead leg, kill his base.', target: 'legs', atkMult: 1.00, defMult: 1.00, power: 0.90, staminaCost: 9,  koWeight: 0.0, speed: 0.50 },
  knee:       { id: 'knee',       label: 'Knee',        blurb: 'Clinch weapon — heavy, tiring.', target: 'body', atkMult: 1.25, defMult: 0.85, power: 1.15, staminaCost: 13, koWeight: 0.6, speed: 0.30 },
  elbow:      { id: 'elbow',      label: 'Elbow',       blurb: 'Short, sharp, cuts — high risk.', target: 'head', atkMult: 1.20, defMult: 0.95, power: 1.15, staminaCost: 10, koWeight: 1.0, speed: 0.55 },
};

export const STRIKE_PALETTE: readonly StrikeId[] = ['jab', 'powerPunch', 'bodyKick', 'legKick', 'knee', 'elbow'] as const;

export function strikeProfile(id: StrikeId): StrikeProfile {
  return STRIKES[id];
}
