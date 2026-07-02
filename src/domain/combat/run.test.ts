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
  it('startNextFight throws once the run is over (permadeath cannot be bypassed)', () => {
    let r = startNextFight(draftInto());
    r = settleFight(r, { ...r.fight!, phase: 'finished', outcome: { winner: 'opponent', method: 'KO', round: 1 } });
    expect(r.phase).toBe('run-over');
    expect(() => startNextFight(r)).toThrow();
  });

  // ── Phase-guard completeness: applyDraft ─────────────────────────────────────
  it('applyDraft only works from the drafting phase', () => {
    const fighter = { name: 'Champ', statLine: ARCHETYPES.allrounder };
    // Happy path: drafting → pre-fight with the fighter set.
    const drafted = applyDraft(startRun('s'), fighter);
    expect(drafted.phase).toBe('pre-fight');
    expect(drafted.fighter?.name).toBe('Champ');
    // Guarded: any non-drafting phase must throw (can't overwrite the fighter mid-run).
    expect(() => applyDraft({ ...drafted, phase: 'pre-fight' }, fighter)).toThrow();
    expect(() => applyDraft({ ...drafted, phase: 'fighting' }, fighter)).toThrow();
    expect(() => applyDraft({ ...drafted, phase: 'run-over' }, fighter)).toThrow();
  });

  // ── Phase-guard completeness: settleFight ────────────────────────────────────
  it('settleFight only settles the active fight from the fighting phase', () => {
    const r = startNextFight(draftInto()); // phase 'fighting', fight active
    const won = { ...r.fight!, phase: 'finished' as const, outcome: { winner: 'player' as const, method: 'KO' as const, round: 1 } };
    // Guarded: cannot settle from a non-fighting phase (would revive a dead run).
    expect(() => settleFight({ ...r, phase: 'run-over' }, won)).toThrow();
    expect(() => settleFight({ ...r, phase: 'drafting' }, won)).toThrow();
    expect(() => settleFight({ ...r, phase: 'pre-fight' }, won)).toThrow();
    // Guarded: the fightState must match the active fight (seed + fightNumber).
    expect(() => settleFight(r, { ...won, seed: 'someone-elses-fight' })).toThrow();
    expect(() => settleFight(r, { ...won, fightNumber: r.fightNumber + 1 })).toThrow();
    // Happy path still works.
    const settled = settleFight(r, won);
    expect(settled.phase).toBe('pre-fight');
    expect(settled.fightNumber).toBe(2);
  });

  it('settleFight requires an active fight', () => {
    const r = startNextFight(draftInto());
    const won = { ...r.fight!, phase: 'finished' as const, outcome: { winner: 'player' as const, method: 'KO' as const, round: 1 } };
    expect(() => settleFight({ ...r, fight: null }, won)).toThrow();
  });
});
