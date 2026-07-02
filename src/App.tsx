import { useEffect, useState } from 'react';
import {
  startRun, applyDraft, startNextFight, settleFight, applyReward,
  type RunState, type Reward, type FightState,
} from './domain';
import type { DraftedFighter } from './domain/draft';
import { load, save } from './persistence/runStorage';
import { isNewRecord as computeIsNewRecord, commitReign } from './bestReign';
import TopAppBar from './components/TopAppBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightScreen from './screens/FightScreen';
import RewardScreen from './screens/RewardScreen';

export interface AppProps { makeSeed?: () => string; }

export default function App({ makeSeed = () => String(Date.now()) }: AppProps) {
  const [store] = useState(() => load());
  const [run, setRun] = useState<RunState | null>(store.run);
  const [bestReign, setBestReign] = useState<number | null>(store.bestReign);

  useEffect(() => {
    save({ run, bestReign });
  }, [run, bestReign]);

  const handleStartRun = () => {
    if (run && run.phase === 'run-over') {
      setBestReign((b) => commitReign(b, run));
    }
    setRun(startRun(makeSeed()));
  };
  const handleDraftComplete = (d: DraftedFighter) => setRun((r) => (r ? applyDraft(r, d) : r));
  const handleEnterFight = () => setRun((r) => (r ? startNextFight(r) : r));
  const handleSettled = (fight: FightState) => setRun((r) => (r ? settleFight(r, fight) : r));
  const handleReward = (reward: Reward) => setRun((r) => (r ? applyReward(r, reward) : r));

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
    // Resume note: a run parked mid-fight restores the run exactly (fightNumber,
    // fighter, carriedDamage, record, reign) but the current fight itself restarts
    // from its deterministic seed. FightScreen owns transient in-fight state (merged
    // M4/M5); M7 does not lift it into RunState (spec §3/§7/§12). The run is never
    // lost — replaying identical intents reproduces the identical result.
    if (run.phase === 'fighting') {
      if (!run.fighter) return null;
      return (
        <FightScreen
          seed={run.seed}
          fightNumber={run.fightNumber}
          fighter={run.fighter}
          carriedDamage={run.carriedDamage}
          onSettled={handleSettled}
        />
      );
    }
    return <RewardScreen run={run} onReward={handleReward} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopAppBar run={run} />
      <main className="flex-1">{screen()}</main>
    </div>
  );
}
