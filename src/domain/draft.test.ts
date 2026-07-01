import { describe, it, expect } from 'vitest';
import {
  startDraft,
  availableStatIds,
  filledCount,
  suggestedStatId,
  keepStat,
  nameFighter,
  getDraftedFighter,
  type DraftState,
} from './draft';
import { STAT_IDS } from './stats';

function playToNaming(seed: string): DraftState {
  let state = startDraft(seed);
  while (state.status === 'drafting') {
    const stat = suggestedStatId(state);
    if (!stat) throw new Error('no suggestion');
    state = keepStat(state, stat);
  }
  return state;
}

describe('draft — init & queries', () => {
  it('starts drafting with the first fighter rolled and empty slots', () => {
    const state = startDraft('title-run');
    expect(state.status).toBe('drafting');
    expect(state.current?.fighterId).toBe('charles-oliveira');
    expect(state.rollCount).toBe(1);
    expect(state.rolledFighterIds).toEqual(['charles-oliveira']);
    expect(state.name).toBeNull();
    for (const stat of STAT_IDS) {
      expect(state.slots[stat]).toBeNull();
    }
  });

  it('is deterministic for a given seed', () => {
    expect(startDraft('draft-1').current?.fighterId).toBe('francis-ngannou');
  });

  it('exposes all nine stats as available at the start', () => {
    const state = startDraft('title-run');
    expect(availableStatIds(state)).toEqual([...STAT_IDS]);
    expect(filledCount(state)).toBe(0);
  });

  it('suggests the highest available stat of the current fighter', () => {
    expect(suggestedStatId(startDraft('title-run'))).toBe('submissions');
  });
});

describe('draft — transitions', () => {
  it('keeps a stat, fills its slot, and rolls the next fighter', () => {
    const start = startDraft('title-run');
    const next = keepStat(start, 'submissions');
    expect(next.slots.submissions).toEqual({ value: 97, sourceFighterId: 'charles-oliveira' });
    expect(filledCount(next)).toBe(1);
    expect(next.status).toBe('drafting');
    expect(next.current?.fighterId).toBe('demetrious-johnson');
    expect(next.rolledFighterIds).toEqual(['charles-oliveira', 'demetrious-johnson']);
  });

  it('does not mutate the previous state', () => {
    const start = startDraft('title-run');
    keepStat(start, 'submissions');
    expect(start.slots.submissions).toBeNull();
    expect(filledCount(start)).toBe(0);
  });

  it('throws when keeping an already-filled slot', () => {
    const start = startDraft('title-run');
    const next = keepStat(start, 'submissions');
    expect(() => keepStat(next, 'submissions')).toThrow();
  });

  it('reaches naming after nine keeps with a deterministic stat line', () => {
    const state = playToNaming('run-42');
    expect(state.status).toBe('naming');
    expect(state.current).toBeNull();
    expect(filledCount(state)).toBe(9);
    expect(state.rolledFighterIds).toEqual([
      'charles-oliveira', 'nate-diaz', 'rose-namajunas', 'khabib-nurmagomedov',
      'conor-mcgregor', 'jan-blachowicz', 'petr-yan', 'anderson-silva', 'daniel-cormier',
    ]);
  });

  it('names the fighter, trims, and completes', () => {
    const named = nameFighter(playToNaming('run-42'), '  The Chosen  ');
    expect(named.status).toBe('complete');
    expect(named.name).toBe('The Chosen');
    const fighter = getDraftedFighter(named);
    expect(fighter.name).toBe('The Chosen');
    expect(fighter.statLine.takedowns).toBe(98);
    expect(fighter.statLine.submissions).toBe(97);
    expect(fighter.statLine.kicks).toBe(92);
  });

  it('rejects empty names and premature access', () => {
    const naming = playToNaming('run-42');
    expect(() => nameFighter(naming, '   ')).toThrow();
    expect(() => getDraftedFighter(naming)).toThrow();
    expect(() => keepStat(naming, 'boxing')).toThrow();
  });
});
