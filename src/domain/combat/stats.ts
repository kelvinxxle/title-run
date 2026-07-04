export type StatId =
  | 'striking' | 'strikingDef'
  | 'takedowns' | 'takedownDef'
  | 'submissions' | 'submissionDef'
  | 'cardio' | 'chin' | 'fightIQ';

export const STAT_IDS: readonly StatId[] = [
  'striking','strikingDef','takedowns','takedownDef',
  'submissions','submissionDef','cardio','chin','fightIQ',
] as const;

export const STAT_LABELS: Record<StatId, string> = {
  striking: 'Striking', strikingDef: 'Striking Defense',
  takedowns: 'Takedowns', takedownDef: 'Takedown Defense',
  submissions: 'Submissions', submissionDef: 'Submission Defense',
  cardio: 'Cardio', chin: 'Chin', fightIQ: 'Fight IQ',
};

export type StatLine = Record<StatId, number>;
export const STAT_MIN = 1;
export const STAT_MAX = 99;

export function clampStat(value: number): number {
  return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(value)));
}
export function isStatId(value: unknown): value is StatId {
  return typeof value === 'string' && (STAT_IDS as readonly string[]).includes(value);
}

export const PHASE_OFFENSE = { strike: 'striking', wrestle: 'takedowns' } as const;
export const PHASE_DEFENSE = { strike: 'strikingDef', wrestle: 'takedownDef' } as const;
