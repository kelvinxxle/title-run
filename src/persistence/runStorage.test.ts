import { describe, it, expect, vi } from 'vitest';
import { load, save, STORAGE_KEY, SCHEMA_VERSION } from './runStorage';
import { startRun } from '../domain';

describe('runStorage', () => {
  it('round-trips run + bestReign', () => {
    const run = startRun('run-42');
    save({ run, bestReign: 3 });
    expect(load()).toEqual({ run, bestReign: 3 });
  });

  it('returns defaults when storage is empty', () => {
    expect(load()).toEqual({ run: null, bestReign: null });
  });

  it('returns defaults and clears the key on malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(load()).toEqual({ run: null, bestReign: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns defaults on a wrong schema version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION + 1, run: startRun('x'), bestReign: 1 }));
    expect(load()).toEqual({ run: null, bestReign: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns defaults on an unknown run phase', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: { ...startRun('x'), phase: 'bogus' }, bestReign: 1 }));
    expect(load()).toEqual({ run: null, bestReign: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('accepts a persisted run === null (no active run)', () => {
    save({ run: null, bestReign: 5 });
    expect(load()).toEqual({ run: null, bestReign: 5 });
  });

  it('save does not throw when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => save({ run: startRun('x'), bestReign: null })).not.toThrow();
    spy.mockRestore();
  });

  it('load returns defaults when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(load()).toEqual({ run: null, bestReign: null });
    spy.mockRestore();
  });
});
