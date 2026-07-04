import type { RunState, RunPhase } from '../domain/combat';

export const STORAGE_KEY = 'title-run:v2';
export const SCHEMA_VERSION = 2;

export interface LoadedState { run: RunState | null; bestReign: number | null; }

function defaults(): LoadedState { return { run: null, bestReign: null }; }

const KNOWN_PHASES: RunPhase[] = ['drafting', 'pre-fight', 'fighting', 'run-over'];

function isValidRun(run: unknown): run is RunState | null {
  if (run === null) return true;
  if (typeof run !== 'object') return false;
  const r = run as Record<string, unknown>;
  if (typeof r['seed'] !== 'string') return false;
  if (typeof r['phase'] !== 'string' || !(KNOWN_PHASES as string[]).includes(r['phase'] as string)) return false;
  if (!Number.isFinite(r['fightNumber'])) return false;
  if (typeof r['isChampion'] !== 'boolean') return false;
  if (!Number.isFinite(r['defenses'])) return false;
  if (typeof r['record'] !== 'object' || r['record'] === null) return false;
  const rec = r['record'] as Record<string, unknown>;
  if (!Number.isFinite(rec['wins']) || !Number.isFinite(rec['losses'])) return false;
  if (r['fighter'] !== null) {
    if (typeof r['fighter'] !== 'object' || r['fighter'] === null) return false;
    const f = r['fighter'] as Record<string, unknown>;
    if (typeof f['name'] !== 'string') return false;
    if (typeof f['statLine'] !== 'object' || f['statLine'] === null) return false;
  }
  if (r['fight'] !== null && (typeof r['fight'] !== 'object' || r['fight'] === null)) return false;
  return true;
}

export function load(): LoadedState {
  let raw: string | null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { return defaults(); }
  if (raw === null) return defaults();
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; run?: unknown; bestReign?: unknown };
    if (parsed.version !== SCHEMA_VERSION || !isValidRun(parsed.run)) { clearKey(); return defaults(); }
    const bestReign =
      typeof parsed.bestReign === 'number' && Number.isInteger(parsed.bestReign) && parsed.bestReign >= 0
        ? parsed.bestReign : null;
    return { run: parsed.run as RunState | null, bestReign };
  } catch { clearKey(); return defaults(); }
}

export function save(state: { run: RunState | null; bestReign: number | null }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: state.run, bestReign: state.bestReign }));
  } catch { /* degrade gracefully */ }
}

function clearKey(): void { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
