import type { StatLine } from './stats';

export type Archetype = 'striker' | 'grappler' | 'wrestler' | 'brawler' | 'allrounder';

export const ARCHETYPES: Record<Archetype, StatLine> = {
  striker: { boxing: 78, kicks: 76, clinch: 58, takedowns: 40, submissions: 38, topControl: 42, cardio: 62, chin: 60, fightIQ: 64 },
  grappler: { boxing: 52, kicks: 50, clinch: 66, takedowns: 74, submissions: 82, topControl: 80, cardio: 64, chin: 60, fightIQ: 70 },
  wrestler: { boxing: 60, kicks: 54, clinch: 72, takedowns: 84, submissions: 56, topControl: 80, cardio: 74, chin: 66, fightIQ: 66 },
  brawler: { boxing: 80, kicks: 66, clinch: 56, takedowns: 44, submissions: 40, topControl: 46, cardio: 52, chin: 82, fightIQ: 52 },
  allrounder: { boxing: 72, kicks: 70, clinch: 66, takedowns: 66, submissions: 64, topControl: 66, cardio: 74, chin: 68, fightIQ: 78 },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as Archetype[];
