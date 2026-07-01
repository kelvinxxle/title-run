import { describe, it, expect } from 'vitest';
import type { StatLine } from './stats';
import { generateOpponent } from './opponent';
import { INTENTS, roundsForFight, durability, startFight } from './fight';
import { resolveRound, carryOutDamage } from './fight';
import type { FightState } from './fight';

const PLAYER: StatLine = { boxing: 82, kicks: 92, clinch: 80, takedowns: 98, submissions: 97, topControl: 88, cardio: 90, chin: 88, fightIQ: 78 };

describe('roundsForFight', () => {
  it('is 3 rounds through fight 4 and 5 rounds from the title fight on', () => {
    expect([1, 2, 3, 4].map(roundsForFight)).toEqual([3, 3, 3, 3]);
    expect([5, 6, 7].map(roundsForFight)).toEqual([5, 5, 5]);
  });
});

describe('durability', () => {
  it('is 50 + chin/2, rounded', () => {
    expect(durability({ ...PLAYER, chin: 52 })).toBe(76);
    expect(durability({ ...PLAYER, chin: 88 })).toBe(94);
    expect(durability({ ...PLAYER, chin: 40 })).toBe(70);
  });
});

describe('INTENTS table', () => {
  it('maps each intent to its offense/defense pairs and finish method', () => {
    expect(INTENTS.strike).toEqual({ offense: ['boxing', 'kicks'], defense: ['chin', 'fightIQ'], finish: 'KO' });
    expect(INTENTS.clinch).toEqual({ offense: ['clinch', 'cardio'], defense: ['clinch', 'chin'], finish: 'KO' });
    expect(INTENTS.takedown).toEqual({ offense: ['takedowns', 'topControl'], defense: ['takedowns', 'fightIQ'], finish: null });
    expect(INTENTS.submit).toEqual({ offense: ['submissions', 'topControl'], defense: ['submissions', 'chin'], finish: 'submission' });
    expect(INTENTS.outpoint).toEqual({ offense: ['fightIQ', 'cardio'], defense: ['fightIQ', 'cardio'], finish: null });
  });
});

describe('startFight', () => {
  it('builds an in-progress state with the scaled opponent and round 1', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    expect(s.status).toBe('in-progress');
    expect(s.round).toBe(1);
    expect(s.rounds).toBe(3);
    expect(s.history).toEqual([]);
    expect(s.outcome).toBeNull();
    expect(s.player).toEqual({ statLine: PLAYER, damage: 0 });
    expect(s.opponent).toEqual({ ...generateOpponent('run-42', 1), damage: 0 });
  });
  it('seeds the player damage from carryInDamage', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 40 });
    expect(s.player.damage).toBe(40);
  });
  it('uses 5 rounds for the title fight', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 5, playerStatLine: PLAYER });
    expect(s.rounds).toBe(5);
  });
});

describe('resolveRound', () => {
  it('produces the exact strike vectors and a decision win vs seed "run-42" fight 1', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    s = resolveRound(s, 'strike');
    expect(s.history[0]).toMatchObject({ round: 1, dominance: 30, roundWinner: 'player', opponentDamage: 18 });
    s = resolveRound(s, 'strike');
    expect(s.history[1]).toMatchObject({ round: 2, dominance: 40, roundWinner: 'player', opponentDamage: 42 });
    s = resolveRound(s, 'strike');
    expect(s.history[2]).toMatchObject({ round: 3, dominance: 25, roundWinner: 'player', opponentDamage: 57 });
    expect(s.status).toBe('won');
    expect(s.outcome).toEqual({ method: 'decision', round: 3, winner: 'player' });
  });

  it('never finishes in round 1 from full health, even in a blowout (measured)', () => {
    const seeds = ['run-42', 'title-run', 'abc', 'seed-7', 'xyz', 'k'];
    for (const seed of seeds) {
      for (let n = 1; n <= 8; n++) {
        for (const intent of ['strike', 'clinch', 'takedown', 'submit', 'outpoint'] as const) {
          let s = startFight({ seed, fightNumber: n, playerStatLine: PLAYER });
          s = resolveRound(s, intent);
          if (s.status !== 'in-progress' && s.round === 1) {
            expect(s.outcome?.method).toBe('decision');
          }
        }
      }
    }
  });

  it('finishes by submission when accumulated damage crosses durability', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    const threshold = durability(s.opponent.statLine);
    const primed: FightState = {
      ...s,
      round: 2,
      opponent: { ...s.opponent, damage: threshold - 1 },
      history: [{ round: 1, intent: 'submit', dominance: 20, roundWinner: 'player', playerDamage: 0, opponentDamage: threshold - 1 }],
    };
    const done = resolveRound(primed, 'submit');
    expect(done.status).toBe('won');
    expect(done.outcome).toEqual({ method: 'submission', round: 2, winner: 'player' });
  });

  it('cannot finish with a control intent even past durability (takedown wins by decision only)', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    const threshold = durability(s.opponent.statLine);
    const primed: FightState = {
      ...s,
      round: 3,
      opponent: { ...s.opponent, damage: threshold + 50 },
      history: [
        { round: 1, intent: 'takedown', dominance: 20, roundWinner: 'player', playerDamage: 0, opponentDamage: threshold + 25 },
        { round: 2, intent: 'takedown', dominance: 20, roundWinner: 'player', playerDamage: 0, opponentDamage: threshold + 50 },
      ],
    };
    const done = resolveRound(primed, 'takedown');
    expect(done.status).toBe('won');
    expect(done.outcome?.method).toBe('decision');
  });

  it('lets the opponent finish the player by their style method', () => {
    const WEAK: StatLine = { boxing: 40, kicks: 40, clinch: 40, takedowns: 40, submissions: 40, topControl: 40, cardio: 40, chin: 40, fightIQ: 40 };
    let s = startFight({ seed: 'run-42', fightNumber: 6, playerStatLine: WEAK });
    expect(s.opponent.style).toBe('brawler');
    while (s.status === 'in-progress') s = resolveRound(s, 'outpoint');
    expect(s.status).toBe('lost');
    expect(s.outcome).toEqual({ method: 'KO', round: 4, winner: 'opponent' });
  });

  it('throws when resolving a settled fight', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    while (s.status === 'in-progress') s = resolveRound(s, 'strike');
    expect(() => resolveRound(s, 'strike')).toThrow(/won|lost|in-progress/);
  });
});

describe('carryOutDamage', () => {
  it('returns the player damage carried out of a won fight', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 12 });
    while (s.status === 'in-progress') s = resolveRound(s, 'strike');
    expect(s.status).toBe('won');
    expect(carryOutDamage(s)).toBe(s.player.damage);
  });
  it('throws if the fight was not won', () => {
    const s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    expect(() => carryOutDamage(s)).toThrow(/not won/);
  });
});
