import type { RunState, RunPhase } from '../domain/combat';
import { STAT_IDS, INITIAL_STEPS, GAME_PLANS, EXCHANGES_PER_ROUND } from '../domain/combat';

export const STORAGE_KEY = 'title-run:v2';
export const SCHEMA_VERSION = 4;

export interface LoadedState { run: RunState | null; bestReign: number | null; }

function defaults(): LoadedState { return { run: null, bestReign: null }; }

const KNOWN_PHASES: RunPhase[] = ['drafting', 'pre-fight', 'fighting', 'run-over'];
const FIGHT_PHASES = ['in-round', 'corner', 'finish-window', 'ground', 'finished'];
const FINISH_METHODS = ['KO', 'submission'];
const WINDOW_METHODS = ['KO', 'submission'];
const OUTCOME_METHODS = ['KO', 'submission', 'decision'];
const SIDES = ['player', 'opponent'];
const ROUND_REPORT_WINNERS = ['player', 'opponent', 'draw'];
const GROUND_POSITIONS = ['guard', 'half-guard', 'side-control', 'mount', 'back'];

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isValidStatLine(x: unknown): boolean {
  if (!isObject(x)) return false;
  return STAT_IDS.every((id) => Number.isFinite(x[id]));
}

function isValidFighter2(x: unknown): boolean {
  if (!isObject(x)) return false;
  if (!isValidStatLine(x['statLine'])) return false;
  return (
    Number.isFinite(x['headDamage']) &&
    Number.isFinite(x['bodyDamage']) &&
    Number.isFinite(x['legDamage']) &&
    Number.isFinite(x['stamina']) &&
    Number.isFinite(x['roundScore'])
  );
}

function isValidRoundReport(x: unknown): boolean {
  if (x === null) return true;
  if (!isObject(x)) return false;
  return (
    Number.isFinite(x['round']) &&
    typeof x['headline'] === 'string' &&
    typeof x['detail'] === 'string' &&
    ROUND_REPORT_WINNERS.includes(x['winner'] as string) &&
    Number.isFinite(x['playerHeadDelta']) &&
    Number.isFinite(x['playerBodyDelta']) &&
    Number.isFinite(x['opponentHeadDelta']) &&
    Number.isFinite(x['opponentBodyDelta'])
  );
}

function normalizeLegacyFightState(x: unknown): unknown {
  if (!isObject(x)) return x;
  return {
    ...x,
    gamePlan: x['gamePlan'] ?? null,
    lastReport: x['lastReport'] ?? null,
  };
}

function normalizeLegacyRun(run: unknown): unknown {
  if (!isObject(run)) return run;
  return run['fight'] !== null
    ? { ...run, fight: normalizeLegacyFightState(run['fight']) }
    : run;
}

function isValidFightState(x: unknown): boolean {
  if (!isObject(x)) return false;
  if (typeof x['seed'] !== 'string') return false;
  if (!Number.isFinite(x['fightNumber']) || !Number.isFinite(x['rounds']) || !Number.isFinite(x['round'])) return false;
  if (!Number.isInteger(x['exchange']) || (x['exchange'] as number) < 1 || (x['exchange'] as number) > EXCHANGES_PER_ROUND) return false;
  if (typeof x['phase'] !== 'string' || !FIGHT_PHASES.includes(x['phase'] as string)) return false;
  if (!isValidFighter2(x['player'])) return false;
  const opp = x['opponent'];
  if (!isValidFighter2(opp)) return false;
  const o = opp as Record<string, unknown>;
  if (typeof o['name'] !== 'string' || typeof o['archetype'] !== 'string') return false;
  const win = x['window'];
  if (win !== null) {
    if (!isObject(win)) return false;
    if (!SIDES.includes(win['side'] as string)) return false;
    if (!WINDOW_METHODS.includes(win['method'] as string)) return false;
    if (!Number.isInteger(win['stepsLeft']) || (win['stepsLeft'] as number) < 1 || (win['stepsLeft'] as number) > INITIAL_STEPS) return false;
  }
  const out = x['outcome'];
  if (out !== null) {
    if (!isObject(out)) return false;
    if (!SIDES.includes(out['winner'] as string)) return false;
    if (!OUTCOME_METHODS.includes(out['method'] as string)) return false;
    if (!Number.isFinite(out['round'])) return false;
  }
  if (!Array.isArray(x['log'])) return false;
  const gamePlan = x['gamePlan'];
  if (!(gamePlan === null || (typeof gamePlan === 'string' && (GAME_PLANS as readonly string[]).includes(gamePlan)))) return false;
  if (!isValidRoundReport(x['lastReport'])) return false;
  // Phase ↔ payload invariant (matches the resolve/finish engine contract):
  //   in-round      → window null AND outcome null
  //   corner        → window null AND outcome null
  //   finish-window → window non-null AND outcome null AND method ∈ FINISH_METHODS (KO/submission)
  //   ground        → window null AND ground non-null (position in GROUND_POSITIONS) AND outcome null
  //   finished      → window null AND outcome non-null
  const phase = x['phase'] as string;
  if (phase === 'in-round' && (win !== null || out !== null)) return false;
  if (phase === 'corner' && (win !== null || out !== null)) return false;
  if (phase === 'finish-window' && (win === null || out !== null || !FINISH_METHODS.includes((win as Record<string, unknown>)['method'] as string))) return false;
  if (phase === 'ground') {
    const gnd = x['ground'];
    if (win !== null || out !== null) return false;
    if (!isObject(gnd)) return false;
    if (!GROUND_POSITIONS.includes((gnd as Record<string, unknown>)['position'] as string)) return false;
  }
  if (phase === 'finished' && (win !== null || out === null)) return false;
  return true;
}

function isValidRun(run: unknown): run is RunState | null {
  if (run === null) return true;
  if (typeof run !== 'object') return false;
  const r = run as Record<string, unknown>;
  if (typeof r['seed'] !== 'string') return false;
  if (typeof r['phase'] !== 'string' || !(KNOWN_PHASES as string[]).includes(r['phase'] as string)) return false;
  if (!Number.isInteger(r['fightNumber']) || (r['fightNumber'] as number) < 1) return false;
  if (typeof r['isChampion'] !== 'boolean') return false;
  if (!Number.isFinite(r['defenses'])) return false;
  if (typeof r['record'] !== 'object' || r['record'] === null) return false;
  const rec = r['record'] as Record<string, unknown>;
  if (!Number.isFinite(rec['wins']) || !Number.isFinite(rec['losses'])) return false;
  if (r['fighter'] !== null) {
    if (!isObject(r['fighter'])) return false;
    const f = r['fighter'] as Record<string, unknown>;
    if (typeof f['name'] !== 'string') return false;
    if (!isValidStatLine(f['statLine'])) return false;
  }
  if (r['fight'] !== null && !isValidFightState(r['fight'])) return false;
  // Phase ↔ fighter invariant: 'drafting' is the only fighterless phase; every other
  // phase must carry a drafted fighter (the non-null branch above already validated it).
  if (r['phase'] === 'drafting' && r['fighter'] !== null) return false;
  if (r['phase'] !== 'drafting' && r['fighter'] === null) return false;
  // Phase invariant: an active fight must have a valid fighter + fight that matches the run.
  if (r['phase'] === 'fighting') {
    if (r['fighter'] === null || r['fight'] === null) return false;
    const fight = r['fight'] as Record<string, unknown>;
    if (fight['seed'] !== r['seed'] || fight['fightNumber'] !== r['fightNumber']) return false;
  }
  return true;
}

export function load(): LoadedState {
  let raw: string | null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { return defaults(); }
  if (raw === null) return defaults();
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; run?: unknown; bestReign?: unknown };
    const normalizedRun = normalizeLegacyRun(parsed.run);
    if (parsed.version !== SCHEMA_VERSION || !isValidRun(normalizedRun)) { clearKey(); return defaults(); }
    const bestReign =
      typeof parsed.bestReign === 'number' && Number.isInteger(parsed.bestReign) && parsed.bestReign >= 0
        ? parsed.bestReign : null;
    return { run: normalizedRun as RunState | null, bestReign };
  } catch { clearKey(); return defaults(); }
}

export function save(state: { run: RunState | null; bestReign: number | null }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: state.run, bestReign: state.bestReign }));
  } catch { /* degrade gracefully */ }
}

function clearKey(): void { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
