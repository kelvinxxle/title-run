import { describe, it, expect } from 'vitest';
import { startRun, applyDraft, startNextFight, settleFight, TITLE_FIGHT } from './run';
import { startDraft, keepStat, availableStatIds, nameFighter, getDraftedFighter } from './draft';
import type { SlotFill } from './draft';
import { STAT_IDS } from './stats';
import type { StatLine, StatId } from './stats';
import { resolveSignature } from './signatures';

// Build a real DraftedFighter with slots for T3 tests
function buildDraftedFighter(seed: string, name: string) {
  let d = startDraft(seed);
  while (d.status === 'drafting') d = keepStat(d, availableStatIds(d)[0]);
  d = nameFighter(d, name);
  return getDraftedFighter(d);
}

const draftInto = () => {
  const df = buildDraftedFighter('run-seed', 'Champ');
  return applyDraft(startRun('run-seed'), df);
};

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
    const df = buildDraftedFighter('phase-guard-seed', 'Champ');
    // Happy path: drafting → pre-fight with the fighter set.
    const drafted = applyDraft(startRun('s'), df);
    expect(drafted.phase).toBe('pre-fight');
    expect(drafted.fighter?.name).toBe('Champ');
    // Guarded: any non-drafting phase must throw (can't overwrite the fighter mid-run).
    expect(() => applyDraft({ ...drafted, phase: 'pre-fight' }, df)).toThrow();
    expect(() => applyDraft({ ...drafted, phase: 'fighting' }, df)).toThrow();
    expect(() => applyDraft({ ...drafted, phase: 'run-over' }, df)).toThrow();
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

describe('M17 T3: signatureId threading', () => {
  it('applyDraft resolves and stores signatureId on RunFighter', () => {
    const df = buildDraftedFighter('sig-test', 'Champ');
    const r = applyDraft(startRun('sig-test'), df);
    expect(r.fighter).not.toBeNull();
    expect(typeof r.fighter!.signatureId).toBe('string');
    expect(r.fighter!.signatureId.length).toBeGreaterThan(0);
  });

  it('signatureId derives from the striking slot sourceFighterId — marquee (conor-mcgregor → the-left-hand)', () => {
    // Build slots with striking pinned to conor-mcgregor (has a marquee override).
    // All other slots use israel-adesanya as a valid roster filler.
    const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 75])) as StatLine;
    const slots = Object.fromEntries(
      STAT_IDS.map((s): [StatId, SlotFill] => [
        s,
        { value: 75, sourceFighterId: s === 'striking' ? 'conor-mcgregor' : 'israel-adesanya' },
      ])
    ) as Record<StatId, SlotFill>;
    const r = applyDraft(startRun('s'), { name: 'Test', statLine: LINE, slots });
    // conor-mcgregor's marquee signature is 'the-left-hand'; verify both by resolver and by literal.
    expect(r.fighter!.signatureId).toBe(resolveSignature('conor-mcgregor').id);
    expect(r.fighter!.signatureId).toBe('the-left-hand');
    // Sanity: would fail if resolved from a different slot (israel-adesanya → 'last-stylebender').
    expect(r.fighter!.signatureId).not.toBe('last-stylebender');
  });

  it('signatureId derives from the striking slot sourceFighterId — archetype fallback (khabib-nurmagomedov → wrestler → level-change-right)', () => {
    // khabib is NOT in MARQUEE_SIGNATURE → resolveSignature falls back to ARCHETYPE_SIGNATURE.wrestler.
    const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 75])) as StatLine;
    const slots = Object.fromEntries(
      STAT_IDS.map((s): [StatId, SlotFill] => [
        s,
        { value: 75, sourceFighterId: s === 'striking' ? 'khabib-nurmagomedov' : 'israel-adesanya' },
      ])
    ) as Record<StatId, SlotFill>;
    const r = applyDraft(startRun('s'), { name: 'Test', statLine: LINE, slots });
    expect(r.fighter!.signatureId).toBe(resolveSignature('khabib-nurmagomedov').id);
    expect(r.fighter!.signatureId).toBe('level-change-right');
    expect(r.fighter!.signatureId).not.toBe('last-stylebender'); // not the 'striking' filler slot
  });

  it('startFight receives signatureId and initialises signatureCharge=0 on FightState', () => {
    const r = startNextFight(draftInto());
    expect(r.fight).not.toBeNull();
    expect(typeof r.fight!.signatureId).toBe('string');
    expect(r.fight!.signatureCharge).toBe(0);
  });

  it('RunFighter signatureId round-trips through startNextFight', () => {
    const r = draftInto();
    const signatureId = r.fighter!.signatureId;
    const r2 = startNextFight(r);
    expect(r2.fight!.signatureId).toBe(signatureId);
  });

  it('all STAT_IDS are present as slots keys in DraftedFighter', () => {
    const df = buildDraftedFighter('slots-check', 'Test');
    for (const statId of STAT_IDS) {
      expect(df.slots[statId]).toBeDefined();
      expect(typeof df.slots[statId].sourceFighterId).toBe('string');
    }
  });
});
