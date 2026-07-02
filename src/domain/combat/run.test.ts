import { describe, it, expect } from 'vitest';
import { startRun, applyDraft, startNextFight, settleFight, TITLE_FIGHT } from './run';
import { ARCHETYPES } from './archetypes';

const draftInto = () => applyDraft(startRun('run-seed'), { name: 'Champ', statLine: ARCHETYPES.allrounder });

describe('run flow (no rewards, fresh each fight)', () => {
  it('has no reward phase and no carriedDamage', () => {
    const r = startRun('s');
    expect(r.phase).toBe('drafting');
    expect('carriedDamage' in r).toBe(false);
  });
  it('a win advances straight to pre-fight and increments fightNumber', () => {
    let r = startNextFight(draftInto());
    const won = { ...r.fight!, phase: 'finished' as const, outcome: { winner: 'player' as const, method: 'KO' as const, round: 1 } };
    r = settleFight(r, won);
    expect(r.phase).toBe('pre-fight');
    expect(r.fightNumber).toBe(2);
  });
  it('winning fight 5 crowns the champion; a loss ends the run', () => {
    let r = { ...draftInto(), fightNumber: TITLE_FIGHT };
    r = startNextFight(r);
    r = settleFight(r, { ...r.fight!, phase: 'finished', outcome: { winner: 'player', method: 'decision', round: 5 } });
    expect(r.isChampion).toBe(true);
    let r2 = startNextFight(r);
    r2 = settleFight(r2, { ...r2.fight!, phase: 'finished', outcome: { winner: 'opponent', method: 'KO', round: 2 } });
    expect(r2.phase).toBe('run-over');
    expect(r2.record.losses).toBe(1);
  });
  it('settleFight throws on an unsettled fight', () => {
    const r = startNextFight(draftInto());
    expect(() => settleFight(r, r.fight!)).toThrow();
  });
});
