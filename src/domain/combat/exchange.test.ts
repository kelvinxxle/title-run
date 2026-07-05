import { describe, it, expect } from 'vitest';
import { startFight, type FightState } from './fightState';
import { resolveExchange, EXCHANGES_PER_ROUND } from './exchange';
import type { ExchangeMove } from './intents';
import type { StatLine } from './stats';

const P: StatLine = { striking: 80, strikingDef: 70, takedowns: 40, takedownDef: 80, submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80 };
const O: StatLine = { striking: 55, strikingDef: 55, takedowns: 45, takedownDef: 55, submissions: 45, submissionDef: 55, cardio: 60, chin: 60, fightIQ: 55 };
const jab: ExchangeMove = { kind: 'strike', strike: 'jab' };

function fresh(seed = 'x-seed', fightNumber = 1): FightState {
  return startFight({ seed, fightNumber, playerStatLine: P, opponent: { id: 'o', name: 'Foe', archetype: 'striker', statLine: O } });
}

describe('resolveExchange', () => {
  it('starts at exchange 1', () => {
    expect(fresh().exchange).toBe(1);
    expect(fresh().phase).toBe('in-round');
  });

  it('advances the exchange counter without advancing the round on a non-terminal beat', () => {
    const s1 = resolveExchange(fresh(), jab);
    expect(s1.phase).toBe('in-round');
    expect(s1.exchange).toBe(2);
    expect(s1.round).toBe(1);
    expect(s1.lastReport).not.toBeNull();
  });

  it(`goes to the corner only after ${EXCHANGES_PER_ROUND} exchanges, resetting exchange to 1`, () => {
    // Use a dominant opponent (striking 90 vs player striking 10) so the exchange always
    // resolves without a player-side finish window. Player uses jab (koWeight 0.4) so the
    // opponent-side timing-read window can never fire. chins of 600 (ROCKED threshold ≈ 336)
    // ensure no damage-path window fires within 3 beats. At fightNumber 1 the opponent AI
    // never chooses powerPunch, keeping the read path closed. No finish window → the third
    // beat deterministically crosses the round boundary to 'corner'.
    const weakPlayer: StatLine = { ...P, striking: 10, chin: 600 };
    const toughOpp = { id: 'o', name: 'Foe', archetype: 'striker' as const, statLine: { ...O, striking: 90, chin: 600, takedowns: 10 } };
    let s = startFight({ seed: 'corner-seed', fightNumber: 1, playerStatLine: weakPlayer, opponent: toughOpp });
    for (let i = 0; i < EXCHANGES_PER_ROUND; i++) s = resolveExchange(s, jab);
    expect(s.phase).toBe('corner');
    expect(s.round).toBe(2);
    expect(s.exchange).toBe(1);
    expect(s.gamePlan).toBeNull();
  });

  it('is deterministic (same seed + same moves ⇒ identical state)', () => {
    const a = resolveExchange(resolveExchange(fresh(), jab), jab);
    const b = resolveExchange(resolveExchange(fresh(), jab), jab);
    expect(a).toEqual(b);
  });

  it('charges per-beat stamina cost but withholds recovery until the round boundary', () => {
    const s0 = fresh();
    const s1 = resolveExchange(s0, jab); // non-terminal beat 1
    // jab costs 6, no recovery yet → player stamina strictly below start
    expect(s1.player.stamina).toBeLessThan(s0.player.stamina);
  });

  it('rejects a call when not in-round', () => {
    const cornerish = { ...fresh(), phase: 'corner' as const };
    expect(() => resolveExchange(cornerish, jab)).toThrow(/in-round/);
  });

  it('a winning takedown opens the player ground-window (interim), freezing the round', () => {
    // takedowns: 99 vs takedownDef: 55 → playerAttackScore ≈ 124 − 55 = 69; even with
    // worst-case oppAttackScore (~11) and seededSwing (−12) dominance > 40 — always positive.
    const wrestler: StatLine = { ...P, takedowns: 99, striking: 40 };
    const s = startFight({ seed: 'td-seed', fightNumber: 1, playerStatLine: wrestler, opponent: { id: 'o', name: 'Foe', archetype: 'striker', statLine: O } });
    const td: ExchangeMove = { kind: 'takedown' };
    const r = resolveExchange(s, td);
    expect(r.phase).toBe('ground-window');
    expect(r.window).toEqual({ side: 'player', method: 'ground', stepsLeft: expect.any(Number) });
    expect(r.round).toBe(1); // frozen
  });

  it('leg damage accrues on a winning leg kick and lowers the loser mobility story', () => {
    // Player striking 99 vs opponent strikingDef 5: playerAttackScore ≫ oppAttackScore
    // regardless of seededSwing (±12) — dominance always positive, player wins with legKick.
    const domPlayer: StatLine = { ...P, striking: 99 };
    const fragileO = { id: 'o', name: 'Foe', archetype: 'striker' as const, statLine: { ...O, striking: 10, strikingDef: 5 } };
    const legKick: ExchangeMove = { kind: 'strike', strike: 'legKick' };
    const s = resolveExchange(startFight({ seed: 'leg-seed', fightNumber: 1, playerStatLine: domPlayer, opponent: fragileO }), legKick);
    expect(s.opponent.legDamage).toBeGreaterThan(0);
    expect(s.player.legDamage).toBe(0);
  });

  // ── Migrated resolve.test golden cases as first-beat assertions ────────────────
  it('the player defense reduces the damage they take on a losing beat (defense is not inert)', () => {
    // A weak-striking player vs a striking opponent loses beat 1; higher strikingDef takes less.
    const opp = { id: 'o', name: 'Foe', archetype: 'striker' as const, statLine: { ...O, striking: 90 } };
    const field: StatLine = { ...P, striking: 30 };
    const lowDef = startFight({ seed: 'def-probe', fightNumber: 1, playerStatLine: { ...field, strikingDef: 1 }, opponent: opp });
    const hiDef = startFight({ seed: 'def-probe', fightNumber: 1, playerStatLine: { ...field, strikingDef: 99 }, opponent: opp });
    const lo = resolveExchange(lowDef, jab);
    const hi = resolveExchange(hiDef, jab);
    const loDmg = lo.player.headDamage + lo.player.bodyDamage + lo.player.legDamage;
    const hiDmg = hi.player.headDamage + hi.player.bodyDamage + hi.player.legDamage;
    expect(loDmg).toBeGreaterThan(0);
    expect(hiDmg).toBeLessThan(loDmg);
  });

  it('the opponent offense affects the damage the player takes on a losing beat (offense is not inert)', () => {
    const field: StatLine = { ...P, striking: 30, strikingDef: 40 };
    const strongOpp = { id: 'a', name: 'A', archetype: 'striker' as const, statLine: { ...O, striking: 99 } };
    const weakOpp = { id: 'b', name: 'B', archetype: 'striker' as const, statLine: { ...O, striking: 20 } };
    const vsStrong = resolveExchange(startFight({ seed: 'off-probe', fightNumber: 1, playerStatLine: field, opponent: strongOpp }), jab);
    const vsWeak = resolveExchange(startFight({ seed: 'off-probe', fightNumber: 1, playerStatLine: field, opponent: weakOpp }), jab);
    const strongDmg = vsStrong.player.headDamage + vsStrong.player.bodyDamage + vsStrong.player.legDamage;
    const weakDmg = vsWeak.player.headDamage + vsWeak.player.bodyDamage + vsWeak.player.legDamage;
    expect(strongDmg).toBeGreaterThan(weakDmg);
  });

  it('a winning body strike drains the loser stamina (winner target drives damage type)', () => {
    const bomber: StatLine = { ...P, striking: 99 };
    const glass = { id: 'o', name: 'Glass', archetype: 'striker' as const, statLine: { ...O, striking: 10, strikingDef: 5 } };
    const bodyKick: ExchangeMove = { kind: 'strike', strike: 'bodyKick' };
    const s = resolveExchange(startFight({ seed: 'body-seed', fightNumber: 1, playerStatLine: bomber, opponent: glass }), bodyKick);
    // player dominates → opponent takes body damage; body damage also bites stamina
    expect(s.opponent.bodyDamage).toBeGreaterThan(0);
  });
});
