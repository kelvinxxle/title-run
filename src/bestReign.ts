import type { RunState } from './domain/combat';

export function isNewRecord(bestReign: number | null, run: RunState): boolean {
  return run.isChampion && (bestReign === null || run.defenses > bestReign);
}

export function commitReign(bestReign: number | null, endedRun: RunState): number | null {
  if (!endedRun.isChampion) return bestReign;
  return bestReign === null ? endedRun.defenses : Math.max(bestReign, endedRun.defenses);
}
