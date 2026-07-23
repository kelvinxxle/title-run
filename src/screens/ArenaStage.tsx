import './arena-idle.css';
import { HybridRig } from '../components/HybridRig';
import type { PlaybackState } from '../replay/useBeatPlayback';
import type { VisualMode } from './arenaVisualMode';
import type { ArchetypeId } from '../domain/combat/archetypes';

interface Identity { fighterId?: string; name: string; archetype: ArchetypeId; cornerColor: string; }
interface ArenaStageProps {
  mode: VisualMode;
  play: PlaybackState;
  player: Identity;
  opponent: Identity;
  hud: React.ReactNode;
  roundLabel: string;
}

export function ArenaStage({ mode, play, player, opponent, hud, roundLabel }: ArenaStageProps) {
  const wrapClass = 'arena-stage' + (mode === 'standing-idle' ? ' arena-idle' : '');
  return (
    <div className={wrapClass} data-mode={mode}
         style={{ position: 'relative', background: 'radial-gradient(120% 80% at 50% 0%,#241d14 0%,#14110c 55%,#131313 100%)' }}>
      {/* HUD band — HTML overlay, OUTSIDE the shake layer */}
      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 5, pointerEvents: 'none',
                    display: 'flex', justifyContent: 'space-between' }}>
        {hud}
      </div>
      <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', zIndex: 6,
                    fontFamily: 'Anton, sans-serif', letterSpacing: '.06em', color: '#f2ca50', fontSize: 13 }}>
        {roundLabel}
      </div>
      <svg viewBox="0 0 390 300" width="100%" role="img" aria-label="Fight arena"
           style={{ display: 'block', maxHeight: 300 }}>
        <defs>
          <radialGradient id="arena-shad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,.55)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <ellipse cx={195} cy={286} rx={180} ry={20} fill="rgba(242,202,80,.08)" />
        <g data-layer="shake" transform={`translate(${play.shakeX},0)`}>
          <g transform="translate(50,0)">
            <HybridRig side="player" facing="right"
              fighterId={player.fighterId} name={player.name} archetype={player.archetype} cornerColor={player.cornerColor}
              pose={play.playerPose}
              flashHead={play.flashHeadPlayer} flashBody={play.flashBodyPlayer} flashLeg={play.flashLegPlayer}
              downed={play.playerPose === 'down'} />
          </g>
          <g transform="translate(160,0)">
            <HybridRig side="opponent" facing="left"
              fighterId={opponent.fighterId} name={opponent.name} archetype={opponent.archetype} cornerColor={opponent.cornerColor}
              pose={play.opponentPose}
              flashHead={play.flashHeadOpponent} flashBody={play.flashBodyOpponent} flashLeg={play.flashLegOpponent}
              downed={play.opponentPose === 'down'} />
          </g>
        </g>
      </svg>
    </div>
  );
}
