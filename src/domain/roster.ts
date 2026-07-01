import { STAT_IDS, clampStat, type StatLine } from './stats';
import { ARCHETYPES, type Archetype } from './archetypes';
import { pick, type Rng } from './rng';

export type WeightClass = 'Strawweight' | 'Flyweight' | 'Bantamweight' | 'Featherweight' | 'Lightweight' | 'Welterweight' | 'Middleweight' | 'Light Heavyweight' | 'Heavyweight';

export type Division = 'M' | 'W';

export interface Fighter {
  id: string;
  name: string;
  weightClass: WeightClass;
  division: Division;
  archetype: Archetype;
  signature: Partial<StatLine>;
}

export const ROSTER: readonly Fighter[] = [
  { id: 'conor-mcgregor', name: 'Conor McGregor', weightClass: 'Featherweight', division: 'M', archetype: 'striker', signature: { boxing: 93, fightIQ: 78, cardio: 52 } },
  { id: 'israel-adesanya', name: 'Israel Adesanya', weightClass: 'Middleweight', division: 'M', archetype: 'striker', signature: { kicks: 94, clinch: 74, fightIQ: 82, chin: 70 } },
  { id: 'max-holloway', name: 'Max Holloway', weightClass: 'Featherweight', division: 'M', archetype: 'striker', signature: { boxing: 90, cardio: 92, chin: 80 } },
  { id: 'khabib-nurmagomedov', name: 'Khabib Nurmagomedov', weightClass: 'Lightweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 98, topControl: 96, cardio: 88, fightIQ: 88 } },
  { id: 'georges-st-pierre', name: 'Georges St-Pierre', weightClass: 'Welterweight', division: 'M', archetype: 'allrounder', signature: { takedowns: 90, fightIQ: 95, cardio: 88 } },
  { id: 'demetrious-johnson', name: 'Demetrious Johnson', weightClass: 'Flyweight', division: 'M', archetype: 'allrounder', signature: { fightIQ: 96, cardio: 90, submissions: 82, takedowns: 82 } },
  { id: 'jon-jones', name: 'Jon Jones', weightClass: 'Light Heavyweight', division: 'M', archetype: 'allrounder', signature: { clinch: 92, fightIQ: 94, kicks: 82, takedowns: 80 } },
  { id: 'charles-oliveira', name: 'Charles Oliveira', weightClass: 'Lightweight', division: 'M', archetype: 'grappler', signature: { submissions: 97, kicks: 78, chin: 58 } },
  { id: 'demian-maia', name: 'Demian Maia', weightClass: 'Welterweight', division: 'M', archetype: 'grappler', signature: { submissions: 96, topControl: 92, takedowns: 84, boxing: 44 } },
  { id: 'amanda-nunes', name: 'Amanda Nunes', weightClass: 'Bantamweight', division: 'W', archetype: 'brawler', signature: { boxing: 92, chin: 84, takedowns: 74 } },
  { id: 'valentina-shevchenko', name: 'Valentina Shevchenko', weightClass: 'Flyweight', division: 'W', archetype: 'allrounder', signature: { kicks: 90, fightIQ: 90, clinch: 80 } },
  { id: 'kamaru-usman', name: 'Kamaru Usman', weightClass: 'Welterweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 88, boxing: 82, cardio: 86, topControl: 86, clinch: 86 } },
  { id: 'francis-ngannou', name: 'Francis Ngannou', weightClass: 'Heavyweight', division: 'M', archetype: 'brawler', signature: { boxing: 96, chin: 78, cardio: 50, fightIQ: 56 } },
  { id: 'stipe-miocic', name: 'Stipe Miocic', weightClass: 'Heavyweight', division: 'M', archetype: 'allrounder', signature: { boxing: 84, cardio: 84, fightIQ: 82, chin: 82 } },
  { id: 'daniel-cormier', name: 'Daniel Cormier', weightClass: 'Heavyweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 90, topControl: 88, clinch: 86, chin: 80 } },
  { id: 'tony-ferguson', name: 'Tony Ferguson', weightClass: 'Lightweight', division: 'M', archetype: 'grappler', signature: { submissions: 88, cardio: 90, chin: 86, kicks: 80 } },
  { id: 'dustin-poirier', name: 'Dustin Poirier', weightClass: 'Lightweight', division: 'M', archetype: 'brawler', signature: { boxing: 90, clinch: 78, cardio: 80, chin: 78 } },
  { id: 'justin-gaethje', name: 'Justin Gaethje', weightClass: 'Lightweight', division: 'M', archetype: 'brawler', signature: { kicks: 90, boxing: 86, chin: 88, cardio: 78 } },
  { id: 'robert-whittaker', name: 'Robert Whittaker', weightClass: 'Middleweight', division: 'M', archetype: 'allrounder', signature: { boxing: 86, cardio: 86, chin: 82, fightIQ: 82 } },
  { id: 'alexander-volkanovski', name: 'Alexander Volkanovski', weightClass: 'Featherweight', division: 'M', archetype: 'allrounder', signature: { cardio: 92, fightIQ: 90, kicks: 82, chin: 82 } },
  { id: 'petr-yan', name: 'Petr Yan', weightClass: 'Bantamweight', division: 'M', archetype: 'striker', signature: { boxing: 88, fightIQ: 84, clinch: 80, cardio: 82 } },
  { id: 'sean-omalley', name: "Sean O'Malley", weightClass: 'Bantamweight', division: 'M', archetype: 'striker', signature: { kicks: 88, boxing: 84, chin: 56 } },
  { id: 'jose-aldo', name: 'Jose Aldo', weightClass: 'Featherweight', division: 'M', archetype: 'striker', signature: { kicks: 92, boxing: 84, takedowns: 72, chin: 80 } },
  { id: 'anderson-silva', name: 'Anderson Silva', weightClass: 'Middleweight', division: 'M', archetype: 'striker', signature: { kicks: 92, clinch: 88, fightIQ: 90, chin: 66 } },
  { id: 'jan-blachowicz', name: 'Jan Blachowicz', weightClass: 'Light Heavyweight', division: 'M', archetype: 'brawler', signature: { boxing: 84, chin: 88, kicks: 78 } },
  { id: 'rose-namajunas', name: 'Rose Namajunas', weightClass: 'Strawweight', division: 'W', archetype: 'striker', signature: { boxing: 82, fightIQ: 82, kicks: 80 } },
  { id: 'zhang-weili', name: 'Zhang Weili', weightClass: 'Strawweight', division: 'W', archetype: 'allrounder', signature: { boxing: 84, cardio: 88, takedowns: 78, chin: 80 } },
  { id: 'brandon-moreno', name: 'Brandon Moreno', weightClass: 'Flyweight', division: 'M', archetype: 'grappler', signature: { submissions: 86, cardio: 88, chin: 82 } },
  { id: 'aljamain-sterling', name: 'Aljamain Sterling', weightClass: 'Bantamweight', division: 'M', archetype: 'grappler', signature: { takedowns: 86, submissions: 86, cardio: 86 } },
  { id: 'colby-covington', name: 'Colby Covington', weightClass: 'Welterweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 86, cardio: 92, topControl: 82 } },
  { id: 'leon-edwards', name: 'Leon Edwards', weightClass: 'Welterweight', division: 'M', archetype: 'allrounder', signature: { kicks: 84, fightIQ: 82, cardio: 82 } },
  { id: 'michael-chandler', name: 'Michael Chandler', weightClass: 'Lightweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 84, boxing: 80, chin: 80, cardio: 76 } },
  { id: 'nate-diaz', name: 'Nate Diaz', weightClass: 'Welterweight', division: 'M', archetype: 'grappler', signature: { submissions: 84, cardio: 90, chin: 88, boxing: 78 } },
  { id: 'cain-velasquez', name: 'Cain Velasquez', weightClass: 'Heavyweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 88, cardio: 92, topControl: 86 } },
  { id: 'tj-dillashaw', name: 'TJ Dillashaw', weightClass: 'Bantamweight', division: 'M', archetype: 'striker', signature: { kicks: 84, fightIQ: 82, clinch: 78, cardio: 82 } },
  { id: 'henry-cejudo', name: 'Henry Cejudo', weightClass: 'Bantamweight', division: 'M', archetype: 'wrestler', signature: { takedowns: 90, fightIQ: 86, clinch: 80 } },
];

export function buildStatLine(fighter: Fighter): StatLine {
  const base = ARCHETYPES[fighter.archetype];
  const line = {} as StatLine;
  for (const stat of STAT_IDS) {
    const raw = fighter.signature[stat] ?? base[stat];
    line[stat] = clampStat(raw);
  }
  return line;
}

export function getFighter(id: string): Fighter {
  const fighter = ROSTER.find((f) => f.id === id);
  if (!fighter) {
    throw new Error(`Unknown fighter id: ${id}`);
  }
  return fighter;
}

export function rollFighter(rng: Rng, excludeIds: readonly string[] = []): Fighter {
  const pool = ROSTER.filter((f) => !excludeIds.includes(f.id));
  return pick(rng, pool.length > 0 ? pool : ROSTER);
}
