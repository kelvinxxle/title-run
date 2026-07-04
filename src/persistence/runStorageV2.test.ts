import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, STORAGE_KEY, SCHEMA_VERSION } from './runStorageV2';
import { startRun, applyDraft, type RunState } from '../domain/combat';
import { STAT_IDS, type StatLine } from '../domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
function preFight(): RunState { return applyDraft(startRun('seed-1'), { name: 'A', statLine: LINE }); }

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
});
