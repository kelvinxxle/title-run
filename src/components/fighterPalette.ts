import { createRng, pick } from '../domain/rng';

export interface FighterPalette {
  skin: string;
  glove: string;
  accent: string;
  hair: string;
  bg: string;
}

const ARCHETYPE_ACCENTS: Record<string, string> = {
  striker: '#e23b2e',
  wrestler: '#2f6fe0',
  grappler: '#7c3aed',
  allrounder: '#22a34a',
  brawler: '#e8791f',
};
const NEUTRAL_ACCENT = '#8a8f98';

const SKIN_TONES = ['#f2c9a0', '#e0a878', '#c98a5e', '#a9683f', '#7d4a2b', '#5a3420'] as const;
const HAIR_COLORS = ['#1c1917', '#3f2a1a', '#6b4a2b', '#b5b5b5', '#c9a227', '#2a2a2a'] as const;
const GLOVE_COLORS = ['#d21f1f', '#1f57d2', '#111827', '#e0a800', '#0f9d58', '#7b2fbf'] as const;
const BG_COLORS = ['#141821', '#1b2430', '#201826', '#13201c', '#241a12', '#1a1a1f'] as const;
const HEAD_SHAPES = [
  { rx: 11, ry: 13 },
  { rx: 12, ry: 12 },
  { rx: 10, ry: 14 },
  { rx: 13, ry: 12 },
] as const;
const HAIR_STYLES = [0, 1, 2, 3, 4, 5] as const;

export function fighterPalette(seed: string, archetype: string): FighterPalette {
  const rng = createRng(seed);
  const bg = pick(rng, BG_COLORS);
  const skin = pick(rng, SKIN_TONES);
  pick(rng, HEAD_SHAPES);  // consumed for draw-order parity with FighterAvatar
  const hair = pick(rng, HAIR_COLORS);
  pick(rng, HAIR_STYLES);  // consumed for draw-order parity with FighterAvatar
  const glove = pick(rng, GLOVE_COLORS);
  const accent = Object.prototype.hasOwnProperty.call(ARCHETYPE_ACCENTS, archetype)
    ? ARCHETYPE_ACCENTS[archetype]
    : NEUTRAL_ACCENT;
  return { skin, glove, accent, hair, bg };
}

// Export constants for use by FighterAvatar
export {
  ARCHETYPE_ACCENTS,
  NEUTRAL_ACCENT,
  SKIN_TONES,
  HAIR_COLORS,
  GLOVE_COLORS,
  BG_COLORS,
  HEAD_SHAPES,
  HAIR_STYLES,
};
