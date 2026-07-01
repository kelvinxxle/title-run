export type ScreenId = 'championship-hub' | 'draft' | 'fight' | 'reward';

export interface ScreenDef {
  id: ScreenId;
  label: string;
  icon: string;
}

export const SCREENS: readonly ScreenDef[] = [
  { id: 'championship-hub', label: 'Hub', icon: 'trophy' },
  { id: 'draft', label: 'Draft', icon: 'groups' },
  { id: 'fight', label: 'Fight', icon: 'sports_mma' },
  { id: 'reward', label: 'Reward', icon: 'military_tech' },
];

export const DEFAULT_SCREEN: ScreenId = 'championship-hub';

export function getScreen(id: ScreenId): ScreenDef {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) {
    throw new Error(`Unknown screen id: ${id}`);
  }
  return screen;
}
