import type { RunState, RunPhase } from '../domain';

export const STORAGE_KEY = 'title-run:v1';
export const SCHEMA_VERSION = 1;

export interface LoadedState {
  run: RunState | null;
  bestReign: number | null;
}

function defaults(): LoadedState {
  return { run: null, bestReign: null };
}

const KNOWN_PHASES: RunPhase[] = ['drafting', 'pre-fight', 'fighting', 'reward', 'run-over'];

function isValidRun(run: unknown): run is RunState | null {
  if (run === null) return true;
  if (typeof run !== 'object') return false;
  const phase = (run as { phase?: unknown }).phase;
  return typeof phase === 'string' && (KNOWN_PHASES as string[]).includes(phase);
}

export function load(): LoadedState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return defaults();
  }
  if (raw === null) return defaults();

  try {
    const parsed = JSON.parse(raw) as { version?: unknown; run?: unknown; bestReign?: unknown };
    if (parsed.version !== SCHEMA_VERSION || !isValidRun(parsed.run)) {
      clearKey();
      return defaults();
    }
    const bestReign = typeof parsed.bestReign === 'number' ? parsed.bestReign : null;
    return { run: (parsed.run as RunState | null), bestReign };
  } catch {
    clearKey();
    return defaults();
  }
}

export function save(state: { run: RunState | null; bestReign: number | null }): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, run: state.run, bestReign: state.bestReign }),
    );
  } catch {
    // degrade gracefully (private mode / quota / unavailable) — in-memory only this session
  }
}

function clearKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
