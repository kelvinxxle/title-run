import { describe, it, expect } from 'vitest';
import { STAT_IDS, STAT_LABELS, clampStat, isStatId, PHASE_OFFENSE, PHASE_DEFENSE } from './stats';

describe('v2 stats', () => {
  it('has the 9 offense/defense stats', () => {
    expect(STAT_IDS).toEqual([
      'striking','strikingDef','takedowns','takedownDef',
      'submissions','submissionDef','cardio','chin','fightIQ',
    ]);
  });
  it('labels every stat', () => {
    for (const id of STAT_IDS) expect(STAT_LABELS[id]).toBeTruthy();
  });
  it('clamps to 1..99 and rounds', () => {
    expect(clampStat(-5)).toBe(1);
    expect(clampStat(140)).toBe(99);
    expect(clampStat(63.6)).toBe(64);
  });
  it('isStatId narrows unknown', () => {
    expect(isStatId('striking')).toBe(true);
    expect(isStatId('boxing')).toBe(false);
    expect(isStatId(5)).toBe(false);
  });
  it('maps each phase to its offensive and defensive stat', () => {
    expect(PHASE_OFFENSE).toEqual({ strike:'striking', wrestle:'takedowns' });
    expect(PHASE_DEFENSE).toEqual({ strike:'strikingDef', wrestle:'takedownDef' });
  });
});
