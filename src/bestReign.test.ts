import { describe, it, expect } from 'vitest';
import { isNewRecord, commitReign } from './bestReign';
import { startRun, type RunState } from './domain';

function runOver(partial: Partial<RunState>): RunState {
  return { ...startRun('x'), phase: 'run-over', ...partial };
}

describe('isNewRecord', () => {
  it('first belt (0 defenses) is a record when no prior best', () => {
    expect(isNewRecord(null, runOver({ isChampion: true, defenses: 0 }))).toBe(true);
  });
  it('a longer reign beats the stored best', () => {
    expect(isNewRecord(1, runOver({ isChampion: true, defenses: 2 }))).toBe(true);
  });
  it('an equal reign is NOT a record (strict >)', () => {
    expect(isNewRecord(2, runOver({ isChampion: true, defenses: 2 }))).toBe(false);
  });
  it('a non-champion ending is never a record', () => {
    expect(isNewRecord(null, runOver({ isChampion: false, defenses: 0 }))).toBe(false);
  });
});

describe('commitReign', () => {
  it('records the first reign when best is null', () => {
    expect(commitReign(null, runOver({ isChampion: true, defenses: 0 }))).toBe(0);
  });
  it('keeps the max of prior best and this reign', () => {
    expect(commitReign(3, runOver({ isChampion: true, defenses: 2 }))).toBe(3);
    expect(commitReign(1, runOver({ isChampion: true, defenses: 2 }))).toBe(2);
  });
  it('leaves best unchanged for a non-champion ending', () => {
    expect(commitReign(4, runOver({ isChampion: false, defenses: 0 }))).toBe(4);
    expect(commitReign(null, runOver({ isChampion: false, defenses: 0 }))).toBeNull();
  });
});
