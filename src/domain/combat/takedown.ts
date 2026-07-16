import type { GroundPosition } from './ground';
import type { ArchetypeId } from './archetypes';

export type TakedownType = 'single-leg' | 'double-leg' | 'trip' | 'body-lock';

export interface TakedownProfile {
  /** Offensive multiplier on the shooter's takedowns score (replaces flat TAKEDOWN_ATK). */
  atkMult: number;
  /** Per-beat stamina charged to shoot. */
  cost: number;
  /** Position secured on a successful shot. */
  landsAt: GroundPosition;
}

// Starting values — TUNED IN T6/T8. Risk/reward: easier shot → weaker position.
export const TAKEDOWN_PROFILES: Record<TakedownType, TakedownProfile> = {
  'single-leg': { atkMult: 1.30, cost: 14, landsAt: 'guard' },
  'double-leg': { atkMult: 1.20, cost: 17, landsAt: 'half-guard' },
  'trip':       { atkMult: 1.10, cost: 12, landsAt: 'side-control' },
  'body-lock':  { atkMult: 1.00, cost: 18, landsAt: 'mount' },
};

export const TAKEDOWN_TYPES: readonly TakedownType[] = ['single-leg', 'double-leg', 'trip', 'body-lock'] as const;

export const TAKEDOWN_LABELS: Record<TakedownType, string> = {
  'single-leg': 'Single Leg',
  'double-leg': 'Double Leg',
  'trip': 'Trip',
  'body-lock': 'Body Lock',
};

export const TAKEDOWN_BLURBS: Record<TakedownType, string> = {
  'single-leg': 'Quick shot — lands often, but only into guard.',
  'double-leg': 'Drive through — reliable, into half guard.',
  'trip': 'Off-balance him — sneaky, straight to side control.',
  'body-lock': 'Muscle him down — hard to land, but you take mount.',
};

/** Deterministic archetype → preferred takedown. PURE (no rng) so the seeded
 *  stream is unchanged when opponentMove threads a takedownType (T3). */
export function opponentTakedownType(archetype: ArchetypeId): TakedownType {
  switch (archetype) {
    case 'wrestler': return 'double-leg';
    case 'grappler': return 'trip';
    case 'brawler': return 'single-leg';
    case 'striker': return 'single-leg';
    case 'allrounder': return 'double-leg';
    default: return 'double-leg';
  }
}
