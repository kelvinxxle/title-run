import { useRef } from 'react';
import type { FightState } from '../domain/combat';

/** Returns the fight snapshot to DISPLAY: live state once `committed`, otherwise the last committed snapshot (held during pre-impact playback). */
export function useCommittedFight(fightState: FightState, committed: boolean): FightState {
  const held = useRef(fightState);
  if (committed) held.current = fightState;
  return held.current;
}
