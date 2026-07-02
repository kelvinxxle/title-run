import { STAT_IDS, clampStat, type StatLine } from './stats';
import { ARCHETYPES, type ArchetypeId } from './archetypes';
import { pick, type Rng } from '../rng';

export interface Fighter { id: string; name: string; archetype: ArchetypeId; signature: Partial<StatLine>; }

export const STARTER_ROSTER: readonly Fighter[] = [
  { id: 'israel-adesanya', name: 'Israel Adesanya', archetype: 'striker',    signature: { striking: 92, strikingDef: 86, fightIQ: 84, chin: 68 } },
  { id: 'khabib-nurmagomedov', name: 'Khabib Nurmagomedov', archetype: 'wrestler', signature: { takedowns: 96, takedownDef: 88, cardio: 88, submissionDef: 84, fightIQ: 86 } },
  { id: 'charles-oliveira', name: 'Charles Oliveira', archetype: 'grappler', signature: { submissions: 96, submissionDef: 78, takedowns: 74, chin: 56, strikingDef: 54 } },
  { id: 'georges-st-pierre', name: 'Georges St-Pierre', archetype: 'allrounder', signature: { takedowns: 90, takedownDef: 86, fightIQ: 94, cardio: 88 } },
  { id: 'francis-ngannou', name: 'Francis Ngannou', archetype: 'brawler',  signature: { striking: 96, chin: 80, strikingDef: 50, cardio: 50, takedownDef: 52 } },
  { id: 'max-holloway', name: 'Max Holloway', archetype: 'striker',        signature: { striking: 90, strikingDef: 80, cardio: 92, chin: 82 } },
  { id: 'demian-maia', name: 'Demian Maia', archetype: 'grappler',        signature: { submissions: 95, submissionDef: 80, takedowns: 84, striking: 44, strikingDef: 48 } },
  // deliberately weak journeyman (avg < 60) — an easy early-ladder draw and a cautionary draft
  { id: 'journeyman-doe', name: 'Danny "Gatekeeper" Doe', archetype: 'brawler', signature: { striking: 54, strikingDef: 44, takedowns: 42, takedownDef: 46, submissions: 38, submissionDef: 44, cardio: 50, chin: 58, fightIQ: 48 } },
];

export function buildStatLine(fighter: Fighter): StatLine {
  const base = ARCHETYPES[fighter.archetype];
  const line = {} as StatLine;
  for (const stat of STAT_IDS) line[stat] = clampStat(fighter.signature[stat] ?? base[stat]);
  return line;
}
export function getFighter(id: string): Fighter {
  const f = STARTER_ROSTER.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown fighter id: ${id}`);
  return f;
}
export function rollFighter(rng: Rng, excludeIds: readonly string[] = []): Fighter {
  const pool = STARTER_ROSTER.filter((f) => !excludeIds.includes(f.id));
  return pick(rng, pool.length > 0 ? pool : STARTER_ROSTER);
}
