/**
 * Per-fighter hero-card framing (CSS object-position).
 *
 * The dramatic draft hero card crops a photo to a tall box (object-cover), so
 * the default `50% 20%` (horizontally centered, biased toward the upper face)
 * flatters most portrait-orientation lead photos. A handful of sources are
 * landscape/square or frame the subject unusually high or low; those get an
 * explicit override here. This map is a curation surface — dropping in a new
 * `public/fighters/{id}.jpg` and, if needed, one line here fully re-frames a
 * fighter with no other code change.
 */
export const HERO_FRAMING: Record<string, string> = {
  // Landscape / square sources — pull the crop toward the (higher) face.
  'ronaldo-souza': '50% 12%',
  'brian-ortega': '50% 15%',
  'mark-hunt': '50% 18%',
  'frank-mir': '50% 15%',
  'cain-velasquez': '50% 15%',
};

export const DEFAULT_HERO_FRAMING = '50% 20%';

export function heroFraming(fighterId: string): string {
  return HERO_FRAMING[fighterId] ?? DEFAULT_HERO_FRAMING;
}
