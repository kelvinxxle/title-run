import { describe, it, expect } from 'vitest';
import { scoreFight } from './judges';
import type { FightState } from './fightState';
import { ARCHETYPES } from './archetypes';
import { STAMINA_MAX } from './stamina';

function makeState(overrides: Partial<FightState> = {}): FightState {
  return {
    seed: 'judge-seed',
    fightNumber: 1,
    rounds: 3,
    round: 3,
    phase: 'finished',
    player: {
      statLine: ARCHETYPES.allrounder,
      headDamage: 0,
      bodyDamage: 0,
      stamina: STAMINA_MAX,
      roundScore: 0,
    },
    opponent: {
      statLine: ARCHETYPES.brawler,
      headDamage: 0,
      bodyDamage: 0,
      stamina: STAMINA_MAX,
      roundScore: 0,
      name: 'Opp',
      archetype: 'brawler',
    },
    window: null,
    outcome: null,
    log: [],
    ...overrides,
  };
}

describe('judges — scoreFight', () => {
  it('higher roundScore wins on the cards', () => {
    const state = makeState({
      player:   { ...makeState().player,   roundScore: 5 },
      opponent: { ...makeState().opponent, roundScore: 3 },
    });
    const outcome = scoreFight(state);
    expect(outcome.winner).toBe('player');
    expect(outcome.method).toBe('decision');
    expect(outcome.round).toBe(state.round);
  });

  it('opponent wins when they have more roundScore', () => {
    const state = makeState({
      player:   { ...makeState().player,   roundScore: 2 },
      opponent: { ...makeState().opponent, roundScore: 7 },
    });
    expect(scoreFight(state).winner).toBe('opponent');
  });

  it('ties break to higher fightIQ', () => {
    // allrounder has fightIQ=78, brawler has fightIQ=54
    const state = makeState({
      player:   { ...makeState().player,   statLine: { ...ARCHETYPES.allrounder, fightIQ: 78 }, roundScore: 4 },
      opponent: { ...makeState().opponent, statLine: { ...ARCHETYPES.brawler,    fightIQ: 54 }, roundScore: 4 },
    });
    expect(scoreFight(state).winner).toBe('player');
  });

  it('ties break to opponent when opponent has higher fightIQ', () => {
    const state = makeState({
      player:   { ...makeState().player,   statLine: { ...ARCHETYPES.brawler,    fightIQ: 54 }, roundScore: 4 },
      opponent: { ...makeState().opponent, statLine: { ...ARCHETYPES.allrounder, fightIQ: 78 }, roundScore: 4 },
    });
    expect(scoreFight(state).winner).toBe('opponent');
  });
});
