export type StatId = 'boxing' | 'kicks' | 'clinch' | 'takedowns' | 'submissions' | 'topControl' | 'cardio' | 'chin' | 'fightIQ';

export const STAT_IDS: readonly StatId[] = ['boxing','kicks','clinch','takedowns','submissions','topControl','cardio','chin','fightIQ'] as const;

export const STAT_LABELS: Record<StatId, string> = {
  boxing: 'Boxing', kicks: 'Kicks', clinch: 'Clinch', takedowns: 'Takedowns', submissions: 'Submissions', topControl: 'Top Control', cardio: 'Cardio', chin: 'Chin', fightIQ: 'Fight IQ',
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
