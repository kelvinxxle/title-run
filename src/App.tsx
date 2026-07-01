import { useState } from 'react';
import { DEFAULT_SCREEN, type ScreenId } from './navigation/screens';
import TopAppBar from './components/TopAppBar';
import BottomNavBar from './components/BottomNavBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightScreen from './screens/FightScreen';
import RewardScreen from './screens/RewardScreen';

const SCREEN_COMPONENTS: Record<ScreenId, () => JSX.Element> = {
  'championship-hub': ChampionshipHubScreen,
  draft: DraftScreen,
  fight: FightScreen,
  reward: RewardScreen,
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
