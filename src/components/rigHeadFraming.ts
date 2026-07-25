export interface RigHeadFrame { y: number; scale: number; }

const DEFAULT: RigHeadFrame = { y: -40, scale: 1 };

// Per-fighter vertical/scale nudges so the face sits in the r=30 circle. Extend as feel-gate
// review of all 38 photos requires (Task 12). Keys are roster ids.
const OVERRIDES: Record<string, RigHeadFrame> = {
  // 'francis-ngannou': { y: -44, scale: 1.05 },
};

export function rigHeadFraming(fighterId: string): RigHeadFrame {
  return OVERRIDES[fighterId] ?? DEFAULT;
}
