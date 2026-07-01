import { STAT_IDS, clampStat } from './stats';
import type { StatLine } from './stats';
import { createRng, pick } from './rng';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import type { Archetype } from './archetypes';

export interface Opponent {
  id: string;
  name: string;
  style: Archetype;
  statLine: StatLine;
}

const FIRST = ['Rex', 'Dmitri', 'Kano', 'Bruno', 'Silas', 'Tariq', 'Lars', 'Hideo', 'Marcus', 'Diego', 'Yuri', 'Cole'] as const;
const NICK = ['The Hammer', 'Ironjaw', 'Nightmare', 'The Surgeon', 'Cyclone', 'Granite', 'The Wolf', 'Bad News'] as const;
const LAST = ['Stone', 'Vega', 'Kruger', 'Mercer', 'Okafor', 'Novak', 'Rivas', 'Falk', 'Draco', 'Voss', 'Ito', 'Bane'] as const;

export function targetRating(fightNumber: number): number {
  return fightNumber <= 4 ? 54 + fightNumber * 4 : 74 + (fightNumber - 5) * 5;
}

export function generateOpponent(seed: string, fightNumber: number): Opponent {
  const rng = createRng(`${seed}#opp${fightNumber}`);
  const style = pick(rng, ARCHETYPE_IDS);
  const first = pick(rng, FIRST);
  const nick = pick(rng, NICK);
  const last = pick(rng, LAST);

  const base = ARCHETYPES[style];
  const baseAvg = STAT_IDS.reduce((sum, k) => sum + base[k], 0) / STAT_IDS.length;
  const delta = targetRating(fightNumber) - baseAvg;

  const statLine = {} as StatLine;
  for (const k of STAT_IDS) {
    statLine[k] = clampStat(base[k] + delta);
  }

  return { id: `opp-${fightNumber}`, name: `${first} "${nick}" ${last}`, style, statLine };
}
