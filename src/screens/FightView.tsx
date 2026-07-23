import { type FightState, type ExchangeMove, type FinishChoice, type GroundAction, type GamePlan, archetypeFromStatLine, fighterIdByName, EXCHANGES_PER_ROUND, signatureReady } from '../domain/combat';
import { bodyPct, headState, healthPct, staminaPct, roundLabel } from '../fightDisplay';
import FighterHealthCard from '../components/FighterHealthCard';
import StrikePanel from '../components/StrikePanel';
import SignatureMeter from '../components/SignatureMeter';
import FinishSequencePanel from '../components/FinishSequencePanel';
import GroundPanel from '../components/GroundPanel';
import OutcomeBanner from '../components/OutcomeBanner';
import CornerScreen from '../components/CornerScreen';
import RoundRecap from '../components/RoundRecap';
import { useBeatPlayback } from '../replay/useBeatPlayback';
import { ArenaStage } from './ArenaStage';
import { arenaVisualMode } from './arenaVisualMode';
import { useCommittedFight } from './useCommittedFight';
import type { ArchetypeId } from '../domain/combat/archetypes';
import type { ResolvedBeat } from '../domain/combat/beat';
import { useRef } from 'react';

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

  // Arena playback wiring (beats may be absent on old fixtures — read defensively)
  const currentBeat = fightState.beats != null && fightState.beats.length > 0
    ? fightState.beats[fightState.beats.length - 1]
    : null;
  const play = useBeatPlayback(currentBeat, fightState.seed);
  const mode = arenaVisualMode(phase, play.isPlaying, currentBeat);

  // Impact latch: once any flash fires during THIS beat, HP is committed for the rest of that beat
  const beatRef = useRef<ResolvedBeat | null>(null);
  const impactSeen = useRef(false);
  // Detect a NEW beat arriving this render — on that same render, play.isPlaying is still
  // false (the useEffect hasn't fired yet). Hold the pre-beat snapshot by forcing committed=false.
  const newBeatArrived = beatRef.current !== currentBeat && currentBeat !== null;
  if (beatRef.current !== currentBeat) { beatRef.current = currentBeat; impactSeen.current = false; }
  const anyFlash =
    play.flashHeadPlayer || play.flashBodyPlayer || (play.flashLegPlayer ?? false) ||
    play.flashHeadOpponent || play.flashBodyOpponent || (play.flashLegOpponent ?? false);
  if (anyFlash) impactSeen.current = true;
  const committed = newBeatArrived ? false : (!play.isPlaying || impactSeen.current);
  const shown = useCommittedFight(fightState, committed);

  // Fighter layer — cornerColor is documented exception to token rule (spec-approved glove colors)
  const playerIdentity = {
    fighterId: undefined,
    name: playerName,
    archetype: archetypeFromStatLine(player.statLine),
    cornerColor: '#e23b2e', // red corner
  };
  const opponentIdentity = {
    fighterId: fighterIdByName(opponent.name),
    name: opponent.name,
    archetype: opponent.archetype as ArchetypeId,
    cornerColor: '#2f6fb0', // blue corner
  };

  return (
    <section
      data-testid="fight-view"
      data-round={fightState.round}
      data-exchange={fightState.exchange}
      data-phase={phase}
      data-player-head={player.headDamage}
      className="p-md flex flex-col gap-md items-center"
    >
      <div className="w-full flex gap-sm">
        <FighterHealthCard
          side="player"
          name={playerName}
          subtitle={`Stamina ${Math.round(staminaPct(shown.player) * 100)}%`}
          badge="YOU"
          healthPct={healthPct(shown.player)}
          bodyPct={bodyPct(shown.player)}
          staminaPct={staminaPct(shown.player)}
          headStateLabel={headState(shown.player)}
          damageFlash={playerFlash}
          avatarSeed={playerName}
          archetype={archetypeFromStatLine(player.statLine)}
        />
        <FighterHealthCard
          side="opponent"
          name={opponent.name}
          subtitle={opponent.archetype}
          badge="OPP"
          healthPct={healthPct(shown.opponent)}
          bodyPct={bodyPct(shown.opponent)}
          staminaPct={staminaPct(shown.opponent)}
          headStateLabel={headState(shown.opponent)}
          damageFlash={opponentFlash}
          avatarSeed={opponent.name}
          archetype={opponent.archetype}
          fighterId={fighterIdByName(opponent.name)}
        />
      </div>

      <ArenaStage
        mode={mode}
        play={play}
        player={playerIdentity}
        opponent={opponentIdentity}
        roundLabel={roundLabel(fightState)}
        hud={null}
      />

      <SignatureMeter charge={fightState.signatureCharge} />

      {!play.isPlaying && (
        <>
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
        </>
      )}
    </section>
  );
}
