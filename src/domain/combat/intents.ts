export type StrikeTactic = 'pressure' | 'counter' | 'pickApart';
export type GroundPlan   = 'ground-and-pound' | 'submission';
export type Target = 'head' | 'body';
export type Phase = 'strike' | 'wrestle';

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
