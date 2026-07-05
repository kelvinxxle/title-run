import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, STORAGE_KEY, SCHEMA_VERSION } from './runStorageV2';
import { startRun, applyDraft, startNextFight, resolveExchange, type RunState, type ExchangeMove, type FightState } from '../domain/combat';
import { STAT_IDS, type StatLine } from '../domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
// Wrestler stat line: high takedowns (99) to win a wrestle for ground-window; seed 'gw-5' verified.
const WRESTLER = Object.fromEntries(STAT_IDS.map((s) => [s, s === 'takedowns' ? 99 : 40])) as StatLine;
function preFight(): RunState { return applyDraft(startRun('seed-1'), { name: 'A', statLine: LINE }); }
const JAB: ExchangeMove = { kind: 'strike', strike: 'jab' };
function continueFromCorner(fight: FightState): FightState {
  return fight.phase === 'corner' ? { ...fight, phase: 'in-round', gamePlan: null } : fight;
}
function midFight(): RunState {
  const started = startNextFight(preFight());
  return { ...started, fight: resolveExchange(started.fight as FightState, JAB) };
}
// seed 'fw-4' deterministically lands in a finish-window after 3 JAB rounds (round 3, opponent KO window).
function finishWindowRun(): RunState {
  let run = startNextFight(applyDraft(startRun('fw-4'), { name: 'A', statLine: LINE }));
  let f = run.fight as FightState;
  while (f.phase === 'in-round' || f.phase === 'corner') {
    f = f.phase === 'corner' ? continueFromCorner(f) : resolveExchange(f, JAB);
  }
  run = { ...run, fight: f };
  return run;
}
// seed 'gw-0' with WRESTLER (takedowns:99, others:40) wins the first wrestle → ground-window.
// (seed updated in T2 — real opponent system changed the fight dynamics; 'gw-0' verified deterministic)
function groundWindowRun(): RunState {
  const run = startNextFight(applyDraft(startRun('gw-0'), { name: 'A', statLine: WRESTLER }));
  return { ...run, fight: resolveExchange(run.fight as FightState, { kind: 'takedown' }) };
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
      seed: 'seed-1', fightNumber: 1, rounds: 3, round: 3, exchange: 1, phase: 'finished',
      player: { statLine: LINE, headDamage: 5, bodyDamage: 0, stamina: 40, legDamage: 0, roundScore: 2 },
      opponent: { statLine: LINE, headDamage: 40, bodyDamage: 0, stamina: 20, legDamage: 0, roundScore: 0, name: 'Rival', archetype: 'brawler' },
      window: null, outcome: { winner: 'player', method: 'KO', round: 3 }, log: [],
      gamePlan: null, lastReport: null,
    };
    const postWin: RunState = {
      seed: 'seed-1', phase: 'pre-fight', fighter: { name: 'A', statLine: LINE },
      fightNumber: 2, record: { wins: 1, losses: 0 }, isChampion: false, defenses: 0, fight: finishedFight,
    };
    save({ run: postWin, bestReign: 2 });
    expect(load()).toEqual({ run: postWin, bestReign: 2 });
  });

  it('loads a legacy mid-fight save missing gamePlan/lastReport by normalizing them to null', () => {
    const mid = midFight();
    const legacyFight = { ...(mid.fight as FightState) } as Partial<FightState> & Record<string, unknown>;
    delete legacyFight.gamePlan;
    delete legacyFight.lastReport;
    store({ ...mid, fight: legacyFight });
    expect(load()).toEqual({ run: { ...mid, fight: { ...(mid.fight as FightState), gamePlan: null, lastReport: null } }, bestReign: 0 });
  });

  it('rejects a finish-window fight with a null window (phase↔payload invariant), and clears the key', () => {
    const run = finishWindowRun();
    store({ ...run, fight: { ...(run.fight as FightState), window: null } });
    expect(load().run).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a finished fight with a null outcome (phase↔payload invariant)', () => {
    const finished: FightState = {
      seed: 'seed-1', fightNumber: 1, rounds: 3, round: 3, exchange: 1, phase: 'finished',
      player: { statLine: LINE, headDamage: 5, bodyDamage: 0, stamina: 40, legDamage: 0, roundScore: 2 },
      opponent: { statLine: LINE, headDamage: 60, bodyDamage: 0, stamina: 20, legDamage: 0, roundScore: 0, name: 'Rival', archetype: 'brawler' },
      window: null, outcome: null, log: [],
      gamePlan: null, lastReport: null,
    };
    store({ ...preFight(), phase: 'fighting', fight: finished });
    expect(load().run).toBeNull();
  });

  it('rejects an in-round fight carrying a non-null window or outcome', () => {
    const run = midFight();
    store({ ...run, fight: { ...(run.fight as FightState), window: { side: 'player', method: 'KO', stepsLeft: 2 } } });
    expect(load().run).toBeNull();
    store({ ...run, fight: { ...(run.fight as FightState), outcome: { winner: 'player', method: 'KO', round: 1 } } });
    expect(load().run).toBeNull();
  });

  it('round-trips a real finish-window run (no false reject)', () => {
    const run = finishWindowRun();
    expect((run.fight as FightState).phase).toBe('finish-window');
    save({ run, bestReign: 0 });
    expect(load()).toEqual({ run, bestReign: 0 });
  });

  it('rejects a finish-window fight with a ground-method window (phase↔payload invariant)', () => {
    const run = finishWindowRun();
    store({ ...run, fight: { ...(run.fight as FightState), window: { side: 'opponent', method: 'ground', stepsLeft: 3 } } });
    expect(load().run).toBeNull();
  });

  it('round-trips a real ground-window run (no false reject)', () => {
    const run = groundWindowRun();
    expect((run.fight as FightState).phase).toBe('ground-window');
    save({ run, bestReign: 0 });
    expect(load()).toEqual({ run, bestReign: 0 });
  });

  it('rejects a ground-window fight with a null window (phase↔payload invariant), and clears the key', () => {
    const run = groundWindowRun();
    store({ ...run, fight: { ...(run.fight as FightState), window: null } });
    expect(load().run).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a ground-window fight with a KO-method window (phase↔payload invariant)', () => {
    const run = groundWindowRun();
    store({ ...run, fight: { ...(run.fight as FightState), window: { side: 'player', method: 'KO', stepsLeft: 3 } } });
    expect(load().run).toBeNull();
  });

  it('rejects a ground-window fight whose window is opponent-side (player-top-control invariant)', () => {
    const run = groundWindowRun();
    store({ ...run, fight: { ...(run.fight as FightState), window: { side: 'opponent', method: 'ground', stepsLeft: 3 } } });
    expect(load().run).toBeNull();
  });

  it('rejects a persisted window with out-of-range or non-integer stepsLeft', () => {
    for (const bad of [0, -1, 4, 2.5]) {
      const run = finishWindowRun();
      store({ ...run, fight: { ...(run.fight as FightState), window: { ...((run.fight as FightState).window!), stepsLeft: bad } } });
      expect(load().run).toBeNull();
    }
  });
  it('accepts a persisted window with an in-range integer stepsLeft', () => {
    const run = finishWindowRun();
    store({ ...run, fight: { ...(run.fight as FightState), window: { ...((run.fight as FightState).window!), stepsLeft: 2 } } });
    expect(load().run).not.toBeNull();
  });

  it('rejects a non-drafting run with a null fighter (pre-fight), and clears the key', () => {
    store({ ...preFight(), phase: 'pre-fight', fighter: null });
    expect(load().run).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a run-over run with a null fighter', () => {
    store({ ...preFight(), phase: 'run-over', fighter: null });
    expect(load().run).toBeNull();
  });

  it('rejects a drafting run that already has a fighter', () => {
    store({ ...preFight(), phase: 'drafting' });
    expect(load().run).toBeNull();
  });

  it('round-trips a real drafting run and a real pre-fight run (no false reject)', () => {
    const drafting = startRun('seed-1');
    save({ run: drafting, bestReign: null });
    expect(load()).toEqual({ run: drafting, bestReign: null });

    const pre = preFight();
    save({ run: pre, bestReign: 4 });
    expect(load()).toEqual({ run: pre, bestReign: 4 });
  });

  it('rejects a pre-fight run with fightNumber: 0 (not a positive integer)', () => {
    store({ ...preFight(), fightNumber: 0 });
    expect(load().run).toBeNull();
  });

  it('rejects a pre-fight run with fightNumber: -1 (not a positive integer)', () => {
    store({ ...preFight(), fightNumber: -1 });
    expect(load().run).toBeNull();
  });

  it('rejects a pre-fight run with fightNumber: 2.5 (not an integer)', () => {
    store({ ...preFight(), fightNumber: 2.5 });
    expect(load().run).toBeNull();
  });

  it('rejects a pre-fight run with fightNumber: NaN (not finite)', () => {
    store({ ...preFight(), fightNumber: NaN });
    expect(load().run).toBeNull();
  });
});
