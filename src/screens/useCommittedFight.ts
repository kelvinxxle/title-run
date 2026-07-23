import { useState, useEffect } from 'react';
import type { FightState } from '../domain/combat';
import type { ResolvedBeat } from '../domain/combat/beat';

/**
 * Returns the fight snapshot to DISPLAY: live state once committed, otherwise
 * the pre-beat snapshot held during pre-impact playback.
 * StrictMode-safe: uses useState+useEffect (no impure render-body ref mutation).
 */
export function useCommittedFight(
  fightState: FightState,
  beat: ResolvedBeat | null,
  release: boolean,
): { shown: FightState; committed: boolean } {
  const [held, setHeld] = useState(() => ({ beat, fight: fightState }));

  const beatChanged = held.beat !== beat;
  const shown = !beatChanged && release ? fightState : held.fight;

  useEffect(() => {
    setHeld(prev => {
      if (prev.beat !== beat) return { beat, fight: prev.fight };           // new beat: keep pre-beat snapshot
      if (release && prev.fight !== fightState) return { beat, fight: fightState }; // commit at release
      return prev;
    });
  }, [beat, fightState, release]);

  return { shown, committed: !beatChanged && release };
}
