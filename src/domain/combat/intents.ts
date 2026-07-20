export type StrikeTactic = 'pressure' | 'counter' | 'pickApart';
export type GroundPlan   = 'ground-and-pound' | 'submission';
export type Target = 'head' | 'body';
export type Phase = 'strike' | 'wrestle';

import type { StrikeId } from './strikes';
import type { TakedownType } from './takedown';

export type RoundIntent =
  | { kind: 'strike'; target: Target; tactic: StrikeTactic }
  | { kind: 'wrestle' };

export const STRIKE_TACTICS: readonly StrikeTactic[] = ['pressure','counter','pickApart'] as const;
export const GROUND_PLANS:  readonly GroundPlan[]   = ['ground-and-pound','submission'] as const;
export const TARGETS:       readonly Target[]       = ['head','body'] as const;

export const KIND_LABELS:          Record<'strike'|'wrestle',string> = { strike: 'Strike', wrestle: 'Wrestle' };
export const STRIKE_TACTIC_LABELS: Record<StrikeTactic,string> = { pressure: 'Pressure', counter: 'Counter', pickApart: 'Pick Apart' };
export const GROUND_PLAN_LABELS:   Record<GroundPlan,string>   = { 'ground-and-pound': 'Ground & Pound', submission: 'Submission' };
export const TARGET_LABELS:        Record<Target,string>       = { head: 'Head', body: 'Body' };

export function isStrike(i: RoundIntent): i is Extract<RoundIntent, { kind: 'strike' }> {
  return i.kind === 'strike';
}
export function intentPhase(i: RoundIntent): Phase {
  return i.kind === 'strike' ? 'strike' : 'wrestle';
}

export type GamePlan = 'push-pace' | 'work-body' | 'stay-disciplined' | 'catch-breath';
export const GAME_PLANS: readonly GamePlan[] = ['push-pace','work-body','stay-disciplined','catch-breath'] as const;
export const GAME_PLAN_LABELS: Record<GamePlan,string> = {
  'push-pace': 'Push the Pace',
  'work-body': 'Work the Body',
  'stay-disciplined': 'Stay Disciplined',
  'catch-breath': 'Catch Your Breath',
};
export const GAME_PLAN_BLURBS: Record<GamePlan,string> = {
  'push-pace': "Empty the tank for damage — but you'll tire.",
  'work-body': 'Break his body down and drain his gas.',
  'stay-disciplined': 'Tighten up and counter — protect the lead.',
  'catch-breath': 'Recover and reset — give ground this round.',
};

export type ExchangeMove =
  | { kind: 'strike'; strike: StrikeId }
  | { kind: 'takedown'; takedownType: TakedownType };

export const MOVE_KIND_LABELS: Record<'strike' | 'takedown', string> = {
  strike: 'Strike',
  takedown: 'Takedown',
};

export function movePhase(m: ExchangeMove): Phase {
  return m.kind === 'strike' ? 'strike' : 'wrestle';
}

export function isTakedown(m: ExchangeMove): m is Extract<ExchangeMove, { kind: 'takedown' }> {
  return m.kind === 'takedown';
}
