import { type FightState, type RoundIntent, type FinishChoice, type GroundPlan, archetypeFromStatLine, fighterIdByName } from '../domain/combat';
import { healthPct, staminaPct, roundLabel } from '../fightDisplay';
import FighterHealthCard from '../components/FighterHealthCard';
import IntentPanelV2 from '../components/IntentPanelV2';
import FinishSequencePanel from '../components/FinishSequencePanel';
import GroundPanel from '../components/GroundPanel';
import OutcomeBanner from '../components/OutcomeBanner';

interface Props {
  fightState: FightState;
  playerName: string;
  onIntent: (intent: RoundIntent) => void;
  onFinishStep: (choice: FinishChoice) => void;
  onGroundStep: (plan: GroundPlan) => void;
  onContinue: () => void;
}

export default function FightView({ fightState, playerName, onIntent, onFinishStep, onGroundStep, onContinue }: Props) {
  const { player, opponent, phase, window: win, outcome } = fightState;
  return (
    <section
      data-testid="fight-view"
      data-round={fightState.round}
      data-phase={phase}
      data-player-head={player.headDamage}
      className="p-md flex flex-col gap-md items-center"
    >
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">{roundLabel(fightState)}</p>
      <div className="w-full flex gap-sm">
        <FighterHealthCard side="player" name={playerName} subtitle={`Stamina ${Math.round(staminaPct(player) * 100)}%`} badge="YOU" healthPct={healthPct(player)} avatarSeed={playerName} archetype={archetypeFromStatLine(player.statLine)} />
        <FighterHealthCard side="opponent" name={opponent.name} subtitle={opponent.archetype} badge="OPP" healthPct={healthPct(opponent)} avatarSeed={opponent.name} archetype={opponent.archetype} fighterId={fighterIdByName(opponent.name)} />
      </div>

      {phase === 'in-round' && (
        <IntentPanelV2 statLine={player.statLine} onCommit={onIntent} />
      )}
      {phase === 'finish-window' && win && (
        <FinishSequencePanel window={win} onChoice={onFinishStep} />
      )}
      {phase === 'ground-window' && win && (
        <GroundPanel window={win} onGround={onGroundStep} />
      )}
      {phase === 'finished' && outcome && (
        <div className="w-full flex flex-col items-center gap-sm">
          <OutcomeBanner outcome={outcome} heading={`${playerName} vs ${opponent.name}`} />
          <button
            type="button"
            data-testid="fight-continue"
            onClick={onContinue}
            className="w-full h-14 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide"
          >
            Continue
          </button>
        </div>
      )}
    </section>
  );
}
