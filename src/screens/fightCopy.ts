import type { Opponent, Archetype } from '../domain';

const READS: Record<Archetype, string> = {
  striker: 'Sharp on the feet — fast hands and range. Trade carefully.',
  brawler: 'Heavy hands and bad intentions — dangerous early, fades late.',
  allrounder: 'No holes in the game — pick your moments.',
  grappler: 'Wants it on the mat — slick submissions, but a suspect chin.',
  wrestler: 'Relentless takedowns and top control — keep it standing.',
};

export function opponentRead(opponent: Opponent): string {
  return READS[opponent.style];
}
