import { STAT_IDS, clampStat } from './stats';
import type { StatLine } from './stats';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import type { ArchetypeId } from './archetypes';
import { createRng, pick } from '../rng';

export interface Opponent {
  id: string;
  name: string;
  archetype: ArchetypeId;
  statLine: StatLine;
}

const FIRST = ['Rex', 'Dmitri', 'Kano', 'Bruno', 'Silas', 'Tariq', 'Lars', 'Hideo', 'Marcus', 'Diego', 'Yuri', 'Cole'] as const;
const NICK = ['The Hammer', 'Ironjaw', 'Nightmare', 'The Surgeon', 'Cyclone', 'Granite', 'The Wolf', 'Bad News'] as const;
const LAST = ['Stone', 'Vega', 'Kruger', 'Mercer', 'Okafor', 'Novak', 'Rivas', 'Falk', 'Draco', 'Voss', 'Ito', 'Bane'] as const;

export function targetRating(fightNumber: number): number {
  // Intercept raised 63→66 in Task 5: makes EARLY fights harder so careless@1
  // drops to ~0.67 (comfortably under the strengthened ≤0.72 band, margin ~0.05),
  // while late fights stay pinned at the 73 cap, so BAND3 (good@9/@10) is unaffected.
  // Cap unchanged.
  const raw = 66 + fightNumber * 1.0;
  return Math.min(73, raw);
}

export function generateOpponent(seed: string, fightNumber: number): Opponent {
  const rng = createRng(`${seed}#opp${fightNumber}`);
  const archetype = pick(rng, ARCHETYPE_IDS);
  const first = pick(rng, FIRST);
  const nick = pick(rng, NICK);
  const last = pick(rng, LAST);

  const base = ARCHETYPES[archetype];
  const baseAvg = STAT_IDS.reduce((sum, k) => sum + base[k], 0) / STAT_IDS.length;
  const delta = targetRating(fightNumber) - baseAvg;

  const statLine = {} as StatLine;
  for (const k of STAT_IDS) {
    statLine[k] = clampStat(base[k] + delta);
  }

  // Re-centering pass: redistribute points lost to 1/99 clamping so the
  // realized average stays within ±1 of targetRating.
  const target = targetRating(fightNumber);
  const n = STAT_IDS.length;
  for (let iter = 0; iter < 20; iter++) {
    const currentSum = STAT_IDS.reduce((s, k) => s + statLine[k], 0);
    const deficit = target * n - currentSum;
    if (Math.abs(deficit) < n) break; // average within ±1 — done
    const direction = deficit > 0 ? 1 : -1;
    const available = STAT_IDS.filter(k => direction > 0 ? statLine[k] < 99 : statLine[k] > 1);
    if (available.length === 0) break;
    const perStat = deficit / available.length;
    for (const k of available) {
      statLine[k] = clampStat(statLine[k] + perStat);
    }
  }

  return { id: `opp-${fightNumber}`, name: `${first} "${nick}" ${last}`, archetype, statLine };
}
