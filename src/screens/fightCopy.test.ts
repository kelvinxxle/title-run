import { describe, it, expect } from 'vitest';
import { opponentRead } from './fightCopy';
import { generateOpponent, type Archetype, type Opponent } from '../domain';

function withStyle(style: Archetype): Opponent {
  return { id: 'x', name: 'Test Fighter', style, statLine: generateOpponent('s', 1).statLine };
}

describe('opponentRead', () => {
  it('returns a non-empty read for every archetype', () => {
    const styles: Archetype[] = ['striker', 'grappler', 'wrestler', 'brawler', 'allrounder'];
    for (const style of styles) {
      expect(opponentRead(withStyle(style)).length).toBeGreaterThan(0);
    }
  });

  it('gives a grappler a mat-focused read', () => {
    expect(opponentRead(withStyle('grappler'))).toMatch(/mat|submission/i);
  });

  it('gives a striker a standup read', () => {
    expect(opponentRead(withStyle('striker'))).toMatch(/feet|hands|range/i);
  });
});
