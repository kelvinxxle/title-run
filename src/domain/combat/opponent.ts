import type { StatLine } from './stats';
import { STAT_IDS } from './stats';
import type { ArchetypeId } from './archetypes';
import { createRng, shuffle } from '../rng';
import { STARTER_ROSTER, buildStatLine } from './roster';
import type { Fighter } from './roster';

export interface Opponent {
  id: string;
  name: string;
  archetype: ArchetypeId;
  statLine: StatLine;
}

// Compute tiers once at module load: sort all roster fighters by overall ascending,
// then split into 5 tiers of 8 fighters each (Tier 1 = weakest, Tier 5 = strongest).
const _sorted: Fighter[] = STARTER_ROSTER.map(f => f).sort((a, b) => {
  const overallOf = (f: Fighter) =>
    STAT_IDS.reduce((sum, k) => sum + buildStatLine(f)[k], 0) / STAT_IDS.length;
  return overallOf(a) - overallOf(b);
});

export const TIERS: readonly (readonly Fighter[])[] = [0, 1, 2, 3, 4].map(t =>
  _sorted.slice(t * 8, (t + 1) * 8),
);

export function generateOpponent(seed: string, fightNumber: number): Opponent {
  if (!Number.isInteger(fightNumber) || fightNumber < 1) {
    throw new Error(`generateOpponent: fightNumber must be a positive integer, got ${fightNumber}`);
  }
  // Fights 1-4 → tiers 1-4 (0-indexed: 0-3); fight 5+ → tier 5 (index 4)
  const tierIndex = fightNumber <= 4 ? fightNumber - 1 : 4;
  const tier = TIERS[tierIndex];

  let fighter: Fighter;
  if (fightNumber <= 4) {
    // One seeded draw from the tier; different tiers across fights guarantees no repeats.
    const rng = createRng(`${seed}#opp${fightNumber}`);
    const idx = Math.floor(rng() * tier.length);
    fighter = tier[idx];
  } else {
    // Champions: cycle through a seeded permutation of Tier 5 (8 fighters per cycle).
    const cycle = Math.floor((fightNumber - 5) / 8);
    const idx = (fightNumber - 5) % 8;
    const rng = createRng(`${seed}#champions#${cycle}`);
    const perm = shuffle(rng, tier);
    fighter = perm[idx];
  }

  return {
    id: fighter.id,
    name: fighter.name,
    archetype: fighter.archetype,
    statLine: buildStatLine(fighter),
  };
}
