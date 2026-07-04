import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, STORAGE_KEY, SCHEMA_VERSION } from './runStorageV2';
import { startRun, applyDraft, startNextFight, resolveRound, type RunState, type RoundIntent, type FightState } from '../domain/combat';
import { STAT_IDS, type StatLine } from '../domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
function preFight(): RunState { return applyDraft(startRun('seed-1'), { name: 'A', statLine: LINE }); }
const JAB: RoundIntent = { where: 'strike', target: 'head', approach: 'technical' };
function midFight(): RunState {
  const started = startNextFight(preFight());
  return { ...started, fight: resolveRound(started.fight as FightState, JAB) };
}
function store(run: unknown): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run, bestReign: 0 }));
}

describe('runStorageV2', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a valid v2 run', () => {
    const run = preFight();
    save({ run, bestReign: 3 });
    expect(load()).toEqual({ run, bestReign: 3 });
  });

  it('returns defaults when nothing is stored', () => {
    expect(load()).toEqual({ run: null, bestReign: null });
  });

  it('rejects a wrong schema version and clears the key', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, run: preFight(), bestReign: 0 }));
    expect(load()).toEqual({ run: null, bestReign: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a malformed run blob (phase-valid but missing fields)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: { phase: 'pre-fight' }, bestReign: 0 }));
    expect(load().run).toBeNull();
  });

  it('coerces a non-integer/negative bestReign to null', () => {
    save({ run: null, bestReign: null });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: null, bestReign: -3 }));
    expect(load().bestReign).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: null, bestReign: 2.5 }));
    expect(load().bestReign).toBeNull();
  });

  it('rejects a fighting run whose fight is a same-schema-but-empty object, and clears the key', () => {
    store({ ...preFight(), phase: 'fighting', fight: {} });
    expect(load().run).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a fighting run with a null fight (phase invariant)', () => {
    store({ ...preFight(), phase: 'fighting', fight: null });
    expect(load().run).toBeNull();
  });

  it('rejects a fighting run whose fight seed/fightNumber does not match the run', () => {
    const run = midFight();
    store({ ...run, fight: { ...(run.fight as FightState), seed: 'other-seed' } });
    expect(load().run).toBeNull();
    store({ ...run, fight: { ...(run.fight as FightState), fightNumber: 99 } });
    expect(load().run).toBeNull();
  });

  it('rejects a run whose fighter.statLine is missing stat keys', () => {
    store({ ...preFight(), fighter: { name: 'A', statLine: {} } });
    expect(load().run).toBeNull();
  });

  it('round-trips a real mid-fight run and a finished-fight pre-fight run', () => {
    const mid = midFight();
    save({ run: mid, bestReign: 1 });
    expect(load()).toEqual({ run: mid, bestReign: 1 });

    const finishedFight: FightState = {
      seed: 'seed-1', fightNumber: 1, rounds: 3, round: 3, phase: 'finished',
      player: { statLine: LINE, headDamage: 5, bodyDamage: 0, stamina: 40, roundScore: 2 },
      opponent: { statLine: LINE, headDamage: 40, bodyDamage: 0, stamina: 20, roundScore: 0, name: 'Rival', archetype: 'brawler' },
      window: null, outcome: { winner: 'player', method: 'KO', round: 3 }, log: [],
    };
    const postWin: RunState = {
      seed: 'seed-1', phase: 'pre-fight', fighter: { name: 'A', statLine: LINE },
      fightNumber: 2, record: { wins: 1, losses: 0 }, isChampion: false, defenses: 0, fight: finishedFight,
    };
    save({ run: postWin, bestReign: 2 });
    expect(load()).toEqual({ run: postWin, bestReign: 2 });
  });
});
