import { describe, it, expect } from 'vitest';
import { startRun, applyDraft } from './run';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

describe('startRun', () => {
  it('begins a run in the drafting phase with no fighter', () => {
    const run = startRun('run-42');
    expect(run).toEqual({
      seed: 'run-42',
      phase: 'drafting',
      fighter: null,
      fightNumber: 1,
      carriedDamage: 0,
      record: { wins: 0, losses: 0 },
      isChampion: false,
      defenses: 0,
      fight: null,
    });
  });

  it('is JSON round-trippable', () => {
    const run = startRun('run-42');
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe('applyDraft', () => {
  it('stores the fighter and advances to pre-fight', () => {
    const run = applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER });
    expect(run.phase).toBe('pre-fight');
    expect(run.fighter).toEqual({ name: 'Kelvin', statLine: PLAYER });
    expect(run.fightNumber).toBe(1);
  });

  it('accepts a DraftedFighter shape and ignores extra fields like slots', () => {
    const drafted = { name: 'Kelvin', statLine: PLAYER, slots: {} } as unknown as { name: string; statLine: typeof PLAYER };
    const run = applyDraft(startRun('run-42'), drafted);
    expect(run.fighter).toEqual({ name: 'Kelvin', statLine: PLAYER });
  });

  it('does not mutate the input run', () => {
    const run = startRun('run-42');
    applyDraft(run, { name: 'Kelvin', statLine: PLAYER });
    expect(run.phase).toBe('drafting');
    expect(run.fighter).toBeNull();
  });
});
