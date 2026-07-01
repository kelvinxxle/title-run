import { useState } from 'react';
import { DEFAULT_SCREEN, type ScreenId } from './navigation/screens';
import TopAppBar from './components/TopAppBar';
import BottomNavBar from './components/BottomNavBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightScreen from './screens/FightScreen';
import RewardScreen from './screens/RewardScreen';
import { startRun, applyDraft, type StatLine } from './domain';

const DEMO_FIGHTER: StatLine = {
  boxing: 82, kicks: 92, clinch: 80, takedowns: 98, submissions: 97,
  topControl: 88, cardio: 90, chin: 88, fightIQ: 78,
};
const DEMO_NAME = 'Ace "Bijon" Carter';
const DEMO_SEED = 'demo';

const SCREEN_COMPONENTS: Record<ScreenId, () => JSX.Element> = {
  'championship-hub': ChampionshipHubScreen,
  draft: DraftScreen,
  fight: () => (
    <FightScreen
      seed={DEMO_SEED}
      fightNumber={1}
      fighter={{ name: DEMO_NAME, statLine: DEMO_FIGHTER }}
      onSettled={() => {}}
    />
  ),
  reward: () => {
    const demoRun = {
      ...applyDraft(startRun('demo-reward'), { name: DEMO_NAME, statLine: DEMO_FIGHTER }),
      phase: 'reward' as const,
      fight: { outcome: { winner: 'player' as const, method: 'decision' as const, round: 3 } } as any,
    };
    return <RewardScreen run={demoRun} onReward={() => {}} />;
  },
};

export default function App() {
  const [current, setCurrent] = useState<ScreenId>(DEFAULT_SCREEN);
  const Screen = SCREEN_COMPONENTS[current];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopAppBar />
      <main className="flex-1">
        <Screen />
      </main>
      <BottomNavBar current={current} onNavigate={setCurrent} />
    </div>
  );
}
