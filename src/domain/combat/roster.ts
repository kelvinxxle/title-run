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
  // ── Strikers ──────────────────────────────────────────────────────────────
  { id: 'conor-mcgregor',       name: 'Conor McGregor',        archetype: 'striker',    signature: { striking: 94, strikingDef: 74, chin: 60, cardio: 56, takedownDef: 60, fightIQ: 82 } },
  { id: 'anderson-silva',       name: 'Anderson Silva',        archetype: 'striker',    signature: { striking: 95, strikingDef: 90, fightIQ: 88, chin: 66, submissionDef: 62 } },
  { id: 'jose-aldo',            name: 'José Aldo',             archetype: 'striker',    signature: { striking: 92, strikingDef: 82, takedownDef: 86, cardio: 74, chin: 76 } },
  { id: 'alexander-volkanovski', name: 'Alexander Volkanovski', archetype: 'striker',   signature: { striking: 90, strikingDef: 84, cardio: 92, takedownDef: 84, chin: 78, fightIQ: 88 } },
  { id: 'robert-whittaker',     name: 'Robert Whittaker',      archetype: 'striker',    signature: { striking: 88, strikingDef: 82, cardio: 86, chin: 78, fightIQ: 82 } },
  { id: 'sean-omalley',         name: "Sean O'Malley",         archetype: 'striker',    signature: { striking: 88, strikingDef: 80, chin: 56, cardio: 66, fightIQ: 72 } },
  { id: 'petr-yan',             name: 'Petr Yan',              archetype: 'striker',    signature: { striking: 88, strikingDef: 82, takedownDef: 80, cardio: 84, fightIQ: 82 } },
  // ── Wrestlers ─────────────────────────────────────────────────────────────
  { id: 'kamaru-usman',         name: 'Kamaru Usman',          archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 86, striking: 78, cardio: 84, chin: 78, fightIQ: 82 } },
  { id: 'colby-covington',      name: 'Colby Covington',       archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 82, cardio: 92, striking: 70, chin: 74 } },
  { id: 'daniel-cormier',       name: 'Daniel Cormier',        archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 84, striking: 76, chin: 82, submissionDef: 76, fightIQ: 84 } },
  { id: 'henry-cejudo',         name: 'Henry Cejudo',          archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 86, striking: 80, cardio: 84, fightIQ: 84 } },
  { id: 'islam-makhachev',      name: 'Islam Makhachev',       archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 86, submissions: 82, cardio: 84, fightIQ: 84 } },
  { id: 'cain-velasquez',       name: 'Cain Velasquez',        archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 82, striking: 78, cardio: 90, chin: 74 } },
  { id: 'chael-sonnen',         name: 'Chael Sonnen',          archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 74, cardio: 82, striking: 64, submissionDef: 50, chin: 72 } },
  { id: 'matt-hughes',          name: 'Matt Hughes',           archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 80, striking: 68, cardio: 80, submissions: 64 } },
  // ── Grapplers ─────────────────────────────────────────────────────────────
  { id: 'nate-diaz',            name: 'Nate Diaz',             archetype: 'grappler',   signature: { submissions: 84, submissionDef: 78, striking: 74, cardio: 88, chin: 82 } },
  { id: 'bj-penn',              name: 'BJ Penn',               archetype: 'grappler',   signature: { submissions: 88, submissionDef: 84, striking: 80, takedownDef: 82, fightIQ: 78 } },
  { id: 'fabricio-werdum',      name: 'Fabrício Werdum',       archetype: 'grappler',   signature: { submissions: 90, submissionDef: 80, striking: 72, takedowns: 74, chin: 64 } },
  { id: 'frank-mir',            name: 'Frank Mir',             archetype: 'grappler',   signature: { submissions: 88, submissionDef: 74, striking: 70, chin: 62 } },
  { id: 'ronaldo-souza',        name: 'Ronaldo Souza',         archetype: 'grappler',   signature: { submissions: 90, submissionDef: 80, takedowns: 80, striking: 72, chin: 66 } },
  { id: 'brian-ortega',         name: 'Brian Ortega',          archetype: 'grappler',   signature: { submissions: 88, submissionDef: 78, striking: 78, chin: 76, cardio: 80 } },
  // ── All-rounders ──────────────────────────────────────────────────────────
  { id: 'jon-jones',            name: 'Jon Jones',             archetype: 'allrounder', signature: { striking: 88, strikingDef: 84, takedowns: 86, takedownDef: 88, submissions: 76, submissionDef: 80, cardio: 84, chin: 82, fightIQ: 94 } },
  { id: 'stipe-miocic',         name: 'Stipe Miocic',          archetype: 'allrounder', signature: { striking: 82, takedowns: 78, takedownDef: 82, cardio: 86, chin: 82, fightIQ: 82 } },
  { id: 'frankie-edgar',        name: 'Frankie Edgar',         archetype: 'allrounder', signature: { striking: 80, takedowns: 82, takedownDef: 80, cardio: 90, chin: 82, fightIQ: 82 } },
  { id: 'tj-dillashaw',         name: 'TJ Dillashaw',          archetype: 'allrounder', signature: { striking: 84, strikingDef: 82, takedowns: 76, cardio: 86, fightIQ: 82 } },
  { id: 'dominick-cruz',        name: 'Dominick Cruz',         archetype: 'allrounder', signature: { striking: 76, strikingDef: 88, takedowns: 78, takedownDef: 82, cardio: 86, fightIQ: 90 } },
  { id: 'leon-edwards',         name: 'Leon Edwards',          archetype: 'allrounder', signature: { striking: 84, strikingDef: 82, takedownDef: 80, cardio: 82, chin: 78, fightIQ: 82 } },
  // ── Brawlers ──────────────────────────────────────────────────────────────
  { id: 'justin-gaethje',       name: 'Justin Gaethje',        archetype: 'brawler',    signature: { striking: 92, chin: 82, cardio: 78, strikingDef: 56, takedownDef: 74, fightIQ: 66 } },
  { id: 'robbie-lawler',        name: 'Robbie Lawler',         archetype: 'brawler',    signature: { striking: 90, chin: 88, strikingDef: 60, cardio: 76 } },
  { id: 'derrick-lewis',        name: 'Derrick Lewis',         archetype: 'brawler',    signature: { striking: 90, chin: 86, strikingDef: 46, cardio: 42, takedownDef: 48, fightIQ: 50 } },
  { id: 'mark-hunt',            name: 'Mark Hunt',             archetype: 'brawler',    signature: { striking: 90, chin: 90, strikingDef: 52, cardio: 46, takedowns: 28, takedownDef: 60 } },
  // deliberately weak gatekeeper (avg < 60) — an easy early-ladder draw and a cautionary draft
  { id: 'rudy-kane',            name: 'Rudy "Last Call" Kane', archetype: 'brawler',    signature: { striking: 52, strikingDef: 42, takedowns: 40, takedownDef: 44, submissions: 36, submissionDef: 42, cardio: 48, chin: 56, fightIQ: 44 } },
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

const _idByName: ReadonlyMap<string, string> = new Map(
  STARTER_ROSTER.map((f) => [f.name, f.id]),
);
export function fighterIdByName(name: string): string | undefined {
  return _idByName.get(name);
}
