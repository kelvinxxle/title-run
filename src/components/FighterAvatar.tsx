import { createRng, pick, type Rng } from '../domain/rng';

export interface FighterAvatarProps {
  seed: string;
  archetype: string;
  name: string;
  size?: number;
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

function hairPath(style: number, cx: number, topY: number, color: string): JSX.Element | null {
  switch (style) {
    case 0:
      return <path d={`M ${cx - 12} 14 Q ${cx} 2 ${cx + 12} 14 L ${cx + 12} 18 Q ${cx} 8 ${cx - 12} 18 Z`} fill={color} />;
    case 1:
      return <rect x={cx - 12} y={topY} width={24} height={5} fill={color} />;
    case 2:
      return <path d={`M ${cx - 11} 16 Q ${cx} 0 ${cx + 11} 16 Z`} fill={color} />;
    case 3:
      return (
        <g fill={color}>
          <rect x={cx - 12} y={9} width={24} height={4} />
          <rect x={cx - 12} y={9} width={4} height={9} />
          <rect x={cx + 8} y={9} width={4} height={9} />
        </g>
      );
    case 4:
      return <path d={`M ${cx - 11} 15 Q ${cx - 6} 4 ${cx} 6 Q ${cx + 6} 4 ${cx + 11} 15 Z`} fill={color} />;
    case 5:
    default:
      return null; // bald / shaved
  }
}

export default function FighterAvatar({ seed, archetype, name, size = 48 }: FighterAvatarProps): JSX.Element {
  const rng: Rng = createRng(seed);
  const bg = pick(rng, BG_COLORS);
  const skin = pick(rng, SKIN_TONES);
  const head = pick(rng, HEAD_SHAPES);
  const hairColor = pick(rng, HAIR_COLORS);
  const hairStyle = pick(rng, HAIR_STYLES);
  const gloveColor = pick(rng, GLOVE_COLORS);

  const accent = Object.prototype.hasOwnProperty.call(ARCHETYPE_ACCENTS, archetype) ? ARCHETYPE_ACCENTS[archetype] : NEUTRAL_ACCENT;
  const cx = 24;

  return (
    <svg
      role="img"
      aria-label={`${name} portrait`}
      data-testid="fighter-avatar"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={24} cy={24} r={23} fill={bg} stroke={accent} strokeWidth={2} />
      {/* neck */}
      <rect x={cx - 4} y={30} width={8} height={8} fill={skin} />
      {/* head */}
      <ellipse cx={cx} cy={22} rx={head.rx} ry={head.ry} fill={skin} />
      {/* brow / accent visor */}
      <rect x={cx - head.rx + 1} y={18} width={head.rx * 2 - 2} height={2} fill={accent} />
      {/* eyes */}
      <circle cx={cx - 4} cy={22} r={1.4} fill="#0b0b0b" />
      <circle cx={cx + 4} cy={22} r={1.4} fill="#0b0b0b" />
      {/* hair / headgear */}
      {hairPath(hairStyle, cx, 9, hairColor)}
      {/* raised gloves */}
      <circle cx={cx - 12} cy={40} r={6} fill={gloveColor} />
      <circle cx={cx + 12} cy={40} r={6} fill={gloveColor} />
      <rect x={cx - 15} y={39} width={6} height={2} fill="#ffffff" />
      <rect x={cx + 9} y={39} width={6} height={2} fill="#ffffff" />
    </svg>
  );
}
