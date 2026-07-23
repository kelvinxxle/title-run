import type { StrikeId } from '../domain/combat/strikes';
import type { BeatMoveClass } from '../domain/combat/beat';

export type MoveFamily = 'punch' | 'kick' | 'takedown' | 'signature';

function assertNever(x: never): never {
  throw new Error(`Unhandled StrikeId: ${String(x)}`);
}

function strikeFamily(id: StrikeId): MoveFamily {
  switch (id) {
    case 'jab':
    case 'powerPunch':
    case 'elbow':
      return 'punch';
    case 'bodyKick':
    case 'legKick':
    case 'knee':
      return 'kick';
    default:
      return assertNever(id);
  }
}

// Must be kept in sync with StrikeId (strikes.ts). strikeFamily() above gives
// compile-time exhaustiveness for the switch body, but this set is a runtime
// guard and TypeScript cannot enforce they match.
const STRIKE_IDS: ReadonlySet<string> = new Set([
  'jab', 'powerPunch', 'elbow', 'bodyKick', 'legKick', 'knee',
]);

export function moveFamily(moveId: string | null, moveClass: BeatMoveClass): MoveFamily {
  if (moveClass === 'signature') return 'signature';
  if (moveClass === 'takedown' || moveClass === 'ground') return 'takedown';
  if (moveId !== null && STRIKE_IDS.has(moveId)) return strikeFamily(moveId as StrikeId);
  // Non-strike, non-signature, non-takedown moveClasses (advance/evade/counter/impact/knockdown)
  // are punch-family by default for the standing hand exchange.
  return 'punch';
}
