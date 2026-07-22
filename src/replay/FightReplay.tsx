import type { CSSProperties, JSX } from 'react';
import FighterRig from '../components/FighterRig';
import { useBeatPlayback } from './useBeatPlayback';
import type { ResolvedBeat } from '../domain/combat/beat';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface FightReplayProps {
  beat: ResolvedBeat | null;
  playerId?: string;
  playerName: string;
  playerArchetype: string;
  opponentId?: string;
  opponentName: string;
  opponentArchetype: string;
  presentationSeed: string;
}

// ---------------------------------------------------------------------------
// Component (thin adapter)
// ---------------------------------------------------------------------------

export default function FightReplay(props: FightReplayProps): JSX.Element {
  const s = useBeatPlayback(props.beat, props.presentationSeed);
  const containerStyle: CSSProperties | undefined =
    s.shakeX !== 0 ? { transform: `translate(${s.shakeX}px, 0)` } : undefined;
  return (
    <div
      data-testid="fight-replay"
      data-playing={s.isPlaying ? 'true' : 'false'}
      data-final-pose-player={s.finalPosePlayer}
      data-final-pose-opponent={s.finalPoseOpponent}
      style={containerStyle}
    >
      <div data-testid="replay-player">
        <FighterRig seed={props.playerId ?? props.playerName} archetype={props.playerArchetype}
          name={props.playerName} pose={s.playerPose} facing="right"
          flashHead={s.flashHeadPlayer} flashBody={s.flashBodyPlayer} downed={s.playerPose === 'down'} />
      </div>
      <div data-testid="replay-opponent">
        <FighterRig seed={props.opponentId ?? props.opponentName} archetype={props.opponentArchetype}
          name={props.opponentName} pose={s.opponentPose} facing="left"
          flashHead={s.flashHeadOpponent} flashBody={s.flashBodyOpponent} downed={s.opponentPose === 'down'} />
      </div>
    </div>
  );
}
