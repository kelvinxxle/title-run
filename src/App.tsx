import { useEffect, useState } from 'react';
import {
  startRun, applyDraft, startNextFight, settleFight, resolveExchange, finishStep, resolveGround, chooseGamePlan,
  type RunState, type ExchangeMove, type FinishChoice, type GroundAction, type DraftedFighter, type GamePlan,
} from './domain/combat';
import { load, save } from './persistence/runStorageV2';
import { isNewRecord as computeIsNewRecord, commitReign } from './bestReign';
import TopAppBar from './components/TopAppBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightView from './screens/FightView';

export interface AppProps { makeSeed?: () => string; }

export default function App({ makeSeed = () => String(Date.now()) }: AppProps) {
  const [store] = useState(() => load());
  const [run, setRun] = useState<RunState | null>(store.run);
  const [bestReign, setBestReign] = useState<number | null>(store.bestReign);

  useEffect(() => { save({ run, bestReign }); }, [run, bestReign]);

  const handleStartRun = () => {
    if (run && run.phase === 'run-over') setBestReign((b) => commitReign(b, run));
    setRun(startRun(makeSeed()));
  };
  const handleDraftComplete = (d: DraftedFighter) =>
    setRun((r) => (r ? applyDraft(r, { name: d.name, statLine: d.statLine }) : r));
  const handleEnterFight = () => setRun((r) => (r ? startNextFight(r) : r));

  const handleMove = (move: ExchangeMove) =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'in-round') return r;
      return { ...r, fight: resolveExchange(r.fight, move) };
    });
  const handleFinishStep = (choice: FinishChoice) =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'finish-window') return r;
      return { ...r, fight: finishStep(r.fight, choice) };
    });
  const handleGroundAction = (plan: GroundAction) =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'ground') return r;
      return { ...r, fight: resolveGround(r.fight, plan) };
    });
  const handleChooseGamePlan = (plan: GamePlan) =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'corner') return r;
      return { ...r, fight: chooseGamePlan(r.fight, plan) };
    });
  const handleContinue = () =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'finished') return r;
      return settleFight(r, r.fight);
    });

  const showNewRecord = run !== null && run.phase === 'run-over' && computeIsNewRecord(bestReign, run);

  function screen() {
    if (run === null || run.phase === 'pre-fight' || run.phase === 'run-over') {
      return (
        <ChampionshipHubScreen
          run={run}
          bestReign={bestReign}
          isNewRecord={showNewRecord}
          onStartRun={handleStartRun}
          onEnterFight={handleEnterFight}
        />
      );
    }
    if (run.phase === 'drafting') return <DraftScreen seed={run.seed} onComplete={handleDraftComplete} />;
    // phase === 'fighting' — controller owns the serializable FightState in run.fight,
    // so a parked mid-fight run resumes EXACTLY (round, damage, stamina, window) from storage.
    // Deep storage validation guarantees a valid fight+fighter here, but fall back to a fresh
    // Hub rather than a blank render if either is somehow missing (no blank-screen path).
    if (!run.fight || !run.fighter) {
      return (
        <ChampionshipHubScreen
          run={null}
          bestReign={bestReign}
          isNewRecord={false}
          onStartRun={handleStartRun}
          onEnterFight={handleEnterFight}
        />
      );
    }
    return (
      <FightView
        fightState={run.fight}
        playerName={run.fighter.name}
        onMove={handleMove}
        onFinishStep={handleFinishStep}
        onGroundAction={handleGroundAction}
        onChooseGamePlan={handleChooseGamePlan}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopAppBar run={run} />
      <main className="flex-1">{screen()}</main>
    </div>
  );
}
