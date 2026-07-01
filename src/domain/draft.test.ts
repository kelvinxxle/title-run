import { describe, it, expect } from 'vitest';
import {
  startDraft,
  availableStatIds,
  filledCount,
  suggestedStatId,
} from './draft';
import { STAT_IDS } from './stats';

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
