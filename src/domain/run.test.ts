import { describe, it, expect } from 'vitest';
import { startRun, applyDraft, startNextFight, settleFight, TITLE_FIGHT, type RunState } from './run';
import type { FightState, FightOutcome } from './fight';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

function readyRun(over: Partial<RunState> = {}): RunState {
  return { ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }), ...over };
}

function settledFight(outcome: FightOutcome, carry: number): FightState {
  return {
    seed: 'run-42', fightNumber: 1, round: 3,
    status: outcome.winner === 'player' ? 'won' : 'lost',
    outcome,
    player: { statLine: PLAYER, damage: carry },
  } as unknown as FightState;
}

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

describe('startNextFight', () => {
  it('starts the ladder fight for the drafted fighter', () => {
    const run = readyRun();
    const next = startNextFight(run);
    expect(next.phase).toBe('fighting');
    expect(next.fight).not.toBeNull();
    expect(next.fight?.fightNumber).toBe(1);
  });

  it('throws when there is no drafted fighter', () => {
    expect(() => startNextFight(startRun('run-42'))).toThrow();
  });
});

describe('settleFight', () => {
  it('records a win and moves to reward (non-title fight)', () => {
    const run = { ...readyRun(), phase: 'fighting' as const };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 3 } as FightOutcome, 0));
    expect(out.phase).toBe('reward');
    expect(out.record).toEqual({ wins: 1, losses: 0 });
    expect(out.isChampion).toBe(false);
    expect(out.defenses).toBe(0);
    expect(out.fight).not.toBeNull();
  });

  it('crowns a champion when winning fight 5 but adds no defense that fight', () => {
    const run = { ...readyRun(), phase: 'fighting' as const, fightNumber: TITLE_FIGHT };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 5 } as FightOutcome, 0));
    expect(out.isChampion).toBe(true);
    expect(out.defenses).toBe(0);
  });

  it('adds a defense when a champion wins fight 6+', () => {
    const run = { ...readyRun(), phase: 'fighting' as const, fightNumber: 6, isChampion: true, defenses: 0 };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 5 } as FightOutcome, 0));
    expect(out.defenses).toBe(1);
  });

  it('ends the run on a loss', () => {
    const run = { ...readyRun(), phase: 'fighting' as const };
    const out = settleFight(run, settledFight({ winner: 'opponent', method: 'KO', round: 2 } as FightOutcome, 0));
    expect(out.phase).toBe('run-over');
    expect(out.record).toEqual({ wins: 0, losses: 1 });
    expect(out.fight).not.toBeNull();
  });
});
