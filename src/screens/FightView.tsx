import { type FightState, type ExchangeMove, type FinishChoice, type GroundAction, type GamePlan, archetypeFromStatLine, fighterIdByName, EXCHANGES_PER_ROUND, signatureReady } from '../domain/combat';
import { bodyPct, headState, healthPct, staminaPct, roundLabel } from '../fightDisplay';
import FighterHealthCard from '../components/FighterHealthCard';
import StrikePanel from '../components/StrikePanel';
import SignatureMeter from '../components/SignatureMeter';
import FinishSequencePanel from '../components/FinishSequencePanel';
import GroundPanel from '../components/GroundPanel';
import FightReplay from '../replay/FightReplay';
import OutcomeBanner from '../components/OutcomeBanner';
import CornerScreen from '../components/CornerScreen';
import RoundRecap from '../components/RoundRecap';

interface Props {
  fightState: FightState;
  playerName: string;
  onMove: (m: ExchangeMove) => void;
  onFinishStep: (choice: FinishChoice) => void;
  onGroundAction: (a: GroundAction) => void;
  onChooseGamePlan: (plan: GamePlan) => void;
  onContinue: () => void;
}

export default function FightView({ fightState, playerName, onMove, onFinishStep, onGroundAction, onChooseGamePlan, onContinue }: Props) {
  const { player, opponent, phase, window: win, outcome, log, rounds, lastReport } = fightState;
  const sigReady = signatureReady(fightState);

  // Damage flash: show deltas from the last resolved round
  const playerFlash = lastReport
    ? { head: lastReport.playerHeadDelta, body: lastReport.playerBodyDelta }
    : undefined;
  const opponentFlash = lastReport
    ? { head: lastReport.opponentHeadDelta, body: lastReport.opponentBodyDelta }
    : undefined;

  return (
    <section
      data-testid="fight-view"
      data-round={fightState.round}
      data-exchange={fightState.exchange}
      data-phase={phase}
      data-player-head={player.headDamage}
      className="p-md flex flex-col gap-md items-center"
    >
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">{roundLabel(fightState)}</p>
      <div className="w-full flex gap-sm">
        <FighterHealthCard
          side="player"
          name={playerName}
          subtitle={`Stamina ${Math.round(staminaPct(player) * 100)}%`}
          badge="YOU"
          healthPct={healthPct(player)}
          bodyPct={bodyPct(player)}
          staminaPct={staminaPct(player)}
          headStateLabel={headState(player)}
          damageFlash={playerFlash}
          avatarSeed={playerName}
          archetype={archetypeFromStatLine(player.statLine)}
        />
        <FighterHealthCard
          side="opponent"
          name={opponent.name}
          subtitle={opponent.archetype}
          badge="OPP"
          healthPct={healthPct(opponent)}
          bodyPct={bodyPct(opponent)}
          staminaPct={staminaPct(opponent)}
          headStateLabel={headState(opponent)}
          damageFlash={opponentFlash}
          avatarSeed={opponent.name}
          archetype={opponent.archetype}
          fighterId={fighterIdByName(opponent.name)}
        />
      </div>

      <FightReplay
        beat={fightState.beats.length > 0 ? fightState.beats[fightState.beats.length - 1] : null}
        playerName={playerName}
        playerArchetype={archetypeFromStatLine(player.statLine)}
        opponentName={opponent.name}
        opponentArchetype={opponent.archetype}
        presentationSeed={fightState.seed}
      />

      <SignatureMeter charge={fightState.signatureCharge} />

      {phase === 'in-round' && (
        <StrikePanel
          statLine={player.statLine}
          exchange={fightState.exchange}
          exchangesPerRound={EXCHANGES_PER_ROUND}
          onMove={onMove}
          sigReady={sigReady}
        />
      )}
      {phase === 'corner' && (
        <CornerScreen
          report={lastReport}
          log={log}
          rounds={rounds}
          nextRound={fightState.round}
          onChoosePlan={onChooseGamePlan}
        />
      )}
      {phase === 'finish-window' && win && (
        <FinishSequencePanel window={win} onChoice={onFinishStep} />
      )}
      {phase === 'ground' && fightState.ground && (
        <GroundPanel ground={fightState.ground} onGroundAction={onGroundAction} />
      )}
      {phase === 'finished' && outcome && (
        <div className="w-full flex flex-col items-center gap-sm">
          {lastReport && <RoundRecap report={lastReport} />}
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
