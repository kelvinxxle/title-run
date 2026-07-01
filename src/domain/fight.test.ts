import { describe, it, expect } from 'vitest';
import type { StatLine } from './stats';
import { generateOpponent } from './opponent';
import { INTENTS, roundsForFight, durability, startFight } from './fight';

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
