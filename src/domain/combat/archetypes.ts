import type { StatLine } from './stats';

export type ArchetypeId = 'striker' | 'wrestler' | 'grappler' | 'allrounder' | 'brawler';

export const ARCHETYPES: Record<ArchetypeId, StatLine> = {
  striker:    { striking: 80, strikingDef: 74, takedowns: 42, takedownDef: 66, submissions: 40, submissionDef: 58, cardio: 64, chin: 62, fightIQ: 68 },
  wrestler:   { striking: 60, strikingDef: 64, takedowns: 84, takedownDef: 82, submissions: 58, submissionDef: 70, cardio: 76, chin: 66, fightIQ: 68 },
  grappler:   { striking: 54, strikingDef: 58, takedowns: 70, takedownDef: 64, submissions: 84, submissionDef: 82, cardio: 66, chin: 60, fightIQ: 72 },
  allrounder: { striking: 72, strikingDef: 72, takedowns: 68, takedownDef: 70, submissions: 66, submissionDef: 68, cardio: 74, chin: 68, fightIQ: 78 },
  brawler:    { striking: 82, strikingDef: 54, takedowns: 46, takedownDef: 56, submissions: 42, submissionDef: 50, cardio: 54, chin: 84, fightIQ: 54 },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

export function archetypeFromStatLine(s: StatLine): ArchetypeId {
  const offensive: [number, ArchetypeId][] = [
    [s.striking,    'striker'],
    [s.takedowns,   'wrestler'],
    [s.submissions, 'grappler'],
  ];
  offensive.sort((a, b) => b[0] - a[0]);
  const [first, second] = offensive;
  if (first[0] - second[0] <= 5) return 'allrounder';
  return first[1];
}

