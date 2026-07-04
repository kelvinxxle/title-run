import { describe, it, expect } from 'vitest';
import { chooseGamePlan } from './fightState';
import type { FightState } from './fightState';
import { resolveRound } from './resolve';
import { ARCHETYPES } from './archetypes';
import type { RoundIntent, StrikeTactic } from './intents';
import { startFight, buildStatLine, getFighter, generateOpponent } from './index';

const OPP = { id: 'o', name: 'Foe', archetype: 'brawler' as const, statLine: ARCHETYPES.brawler };
const start = () => startFight({ seed: 'seed-42', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });

const strike = (target: 'head' | 'body', tactic: StrikeTactic): RoundIntent =>
  ({ kind: 'strike', target, tactic });

describe('resolveRound', () => {
  it('is deterministic for the same seed + intent', () => {
    const a = resolveRound(start(), { kind:'strike', target:'head', tactic:'pickApart' });
    const b = resolveRound(start(), { kind:'strike', target:'head', tactic:'pickApart' });
    expect(a).toEqual(b);
  });
  it('spends stamina (pressure spends more than counter over a round)', () => {
    const p = resolveRound(start(), { kind:'strike', target:'head', tactic:'pressure' });
    const c = resolveRound(start(), { kind:'strike', target:'head', tactic:'counter' });
    expect(p.player.stamina).toBeLessThan(c.player.stamina);
  });
  it('body targeting accumulates body damage on the loser side', () => {
    const s = resolveRound(start(), { kind:'strike', target:'body', tactic:'pressure' });
    expect(s.player.bodyDamage + s.opponent.bodyDamage).toBeGreaterThan(0);
  });

  // ── Step-3 regression: pure strike-vs-strike is numerically unchanged ─────────
  // pickApart ≡ old 'technical' and pressure/counter are unchanged, so a strike
  // exchange against a striking opponent yields the exact dominance and damage as
  // before the redesign (captured from the pre-change engine).
  it('strike-vs-strike matches the pre-redesign dominance and damage exactly', () => {
    const striker = { id: 's', name: 'Str', archetype: 'striker' as const, statLine: ARCHETYPES.striker };
    const s = startFight({ seed: 'reg-seed', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: striker });
    const r = resolveRound(s, { kind:'strike', target:'head', tactic:'pickApart' });
    expect(r.log[0].dominance).toBeCloseTo(-7.553537177667025, 10);
    expect(r.log[0].winner).toBe('opponent');
    expect(r.player.headDamage).toBe(4);
    expect(r.player.bodyDamage).toBe(0);
    expect(r.opponent.headDamage).toBe(0);
    expect(r.opponent.bodyDamage).toBe(0);
  });

  it('opponent-wins: player accrues body damage when oppIntent targets body (winner target drives damage type)', () => {
    // Player striking=1 vs opponent strikingDef=99: dominance is always << 0 (player always loses).
    // Player stamina=10 (<GAS_THRESHOLD 25) → opponentIntent() sets target='body'.
    // Player intent targets 'head' — correct code uses oppIntent.target → body damage.
    const weakPlayer = { ...ARCHETYPES.striker, striking: 1 };
    const ironWall   = { id: 'o2', name: 'Iron', archetype: 'brawler' as const,
                         statLine: { ...ARCHETYPES.brawler, strikingDef: 99 } };
    const base   = startFight({ seed: 'test-body-target', fightNumber: 1,
                                 playerStatLine: weakPlayer, opponent: ironWall });
    const gassed = { ...base, player: { ...base.player, stamina: 10 } };
    const result = resolveRound(gassed, { kind: 'strike', target: 'head', tactic: 'pickApart' });
    // oppIntent.target must be 'body' (player is gassed) and player must lose
    expect(result.player.bodyDamage).toBeGreaterThan(0);
    expect(result.player.headDamage).toBe(0);
  });

  // ── Fix 1: two-sided exchange — the player's DEFENSE and the opponent's OFFENSE matter ──
  it("the player's defense reduces the damage they take (defense is not inert)", () => {
    // Opponent is a brawler → AI attacks with its strongest edge (striking).
    const opp = { id: 'o', name: 'Foe', archetype: 'brawler' as const, statLine: ARCHETYPES.brawler };
    const field = { ...ARCHETYPES.striker, striking: 30 };
    const lowDef  = { ...field, strikingDef: 1 };
    const highDef = { ...field, strikingDef: 99 };
    const intent = strike('head', 'pickApart');
    const lo = resolveRound(startFight({ seed: 'def-probe', fightNumber: 1, playerStatLine: lowDef,  opponent: opp }), intent);
    const hi = resolveRound(startFight({ seed: 'def-probe', fightNumber: 1, playerStatLine: highDef, opponent: opp }), intent);
    const loDmg = lo.player.headDamage + lo.player.bodyDamage;
    const hiDmg = hi.player.headDamage + hi.player.bodyDamage;
    expect(loDmg).toBeGreaterThan(0);          // low-defense player genuinely gets hit
    expect(hiDmg).toBeLessThan(loDmg);         // high-defense player takes strictly less
  });

  it("the opponent's offense affects the exchange (opponent offense is not inert)", () => {
    const field = { ...ARCHETYPES.striker, striking: 30, strikingDef: 40 };
    const strongOpp = { id: 'a', name: 'A', archetype: 'brawler' as const, statLine: { ...ARCHETYPES.brawler, striking: 99 } };
    const weakOpp   = { id: 'b', name: 'B', archetype: 'brawler' as const, statLine: { ...ARCHETYPES.brawler, striking: 20 } };
    const intent = strike('head', 'pickApart');
    const vsStrong = resolveRound(startFight({ seed: 'off-probe', fightNumber: 1, playerStatLine: field, opponent: strongOpp }), intent);
    const vsWeak   = resolveRound(startFight({ seed: 'off-probe', fightNumber: 1, playerStatLine: field, opponent: weakOpp }), intent);
    const strongDmg = vsStrong.player.headDamage + vsStrong.player.bodyDamage;
    const weakDmg   = vsWeak.player.headDamage + vsWeak.player.bodyDamage;
    expect(strongDmg).toBeGreaterThan(weakDmg); // a harder-hitting opponent hurts more
  });

  it("the opponent's choice of phase matters (attacks the player's weakest defense)", () => {
    // A grappler's best edge is takedowns → the AI WRESTLES. The player's takedownDef
    // governs that exchange, so a player porous to takedowns takes strictly more.
    const field = { ...ARCHETYPES.striker, striking: 30 };
    const grapplerOpp = { id: 'g', name: 'G', archetype: 'grappler' as const, statLine: ARCHETYPES.grappler };
    const porousVsWrestle = { ...field, takedownDef: 1 };
    const stoutVsWrestle  = { ...field, takedownDef: 99 };
    const intent = strike('head', 'pickApart');
    const porous = resolveRound(startFight({ seed: 'where-probe', fightNumber: 1, playerStatLine: porousVsWrestle, opponent: grapplerOpp }), intent);
    const stout  = resolveRound(startFight({ seed: 'where-probe', fightNumber: 1, playerStatLine: stoutVsWrestle,  opponent: grapplerOpp }), intent);
    const porousDmg = porous.player.headDamage + porous.player.bodyDamage;
    const stoutDmg  = stout.player.headDamage + stout.player.bodyDamage;
    expect(stoutDmg).toBeLessThan(porousDmg);
  });

  // ── Fix 3: accumulated body damage matters (reduces later-round recovery) ─────
  it('accumulated body damage lowers the victim later-round stamina recovery', () => {
    const opp = { id: 'o', name: 'Foe', archetype: 'brawler' as const, statLine: ARCHETYPES.brawler };
    const base = startFight({ seed: 'body-recovery', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: opp });
    const intent = strike('head', 'pickApart');
    const fresh    = { ...base, player: { ...base.player, stamina: 50, bodyDamage: 0 } };
    const battered = { ...base, player: { ...base.player, stamina: 50, bodyDamage: 60 } };
    const freshNext    = resolveRound(fresh, intent);
    const batteredNext = resolveRound(battered, intent);
    expect(batteredNext.player.stamina).toBeLessThan(freshNext.player.stamina);
  });

  // ── Task 3: opponent takedown → AI ground action routes through finish window ──
  // When a WRESTLER opponent wins the wrestle, its takedown lands and it auto-resolves
  // an AI-chosen ground action against the player. Dangerous outcomes open an
  // opponent-side finish window so the player keeps defensive agency.
  const wrestlerOpp = (over: Partial<typeof ARCHETYPES.wrestler> = {}) =>
    ({ id: 'w', name: 'Wr', archetype: 'wrestler' as const,
       statLine: { ...ARCHETYPES.wrestler, takedowns: 99, striking: 40, ...over } });

  it('opponent GnP that rocks the player opens an opponent-side KO finish window (player defends)', () => {
    // player.submissionDef 58 (≥ LOW_SUB_DEF 55) → AI picks ground-and-pound.
    // Low chin (30 → ROCKED 17) means the GnP damage rocks the player.
    const player = { ...ARCHETYPES.striker, striking: 1, takedownDef: 1, submissionDef: 58, chin: 30 };
    const s = startFight({ seed: 'opp-gnp', fightNumber: 1, playerStatLine: player, opponent: wrestlerOpp() });
    const r = resolveRound(s, strike('head', 'pickApart'));
    expect(r.phase).toBe('finish-window');
    expect(r.window).toEqual({ side: 'opponent', method: 'KO', stepsLeft: 3 });
    // GnP damage (not the interim flat exchange damage) is applied to the player's head.
    // gpDmg = max(8, round((0.5*40 + 0.5*99 − 0.5*74) * 0.7)) = 23.
    expect(r.player.headDamage).toBe(23);
    expect(r.round).toBe(1); // window opened → round NOT advanced
  });

  it('opponent takedown against a low submission defense opens an opponent-side submission window (no head damage)', () => {
    // player.submissionDef 40 (< LOW_SUB_DEF 55) → AI picks submission.
    const player = { ...ARCHETYPES.striker, striking: 1, takedownDef: 1, submissionDef: 40, chin: 30 };
    const s = startFight({ seed: 'opp-sub', fightNumber: 1, playerStatLine: player, opponent: wrestlerOpp() });
    const r = resolveRound(s, strike('head', 'pickApart'));
    expect(r.phase).toBe('finish-window');
    expect(r.window).toEqual({ side: 'opponent', method: 'submission', stepsLeft: 3 });
    expect(r.player.headDamage).toBe(0); // submission threat opens a window; no damage applied
    expect(r.round).toBe(1); // window opened → round NOT advanced
  });

  it('opponent GnP that does NOT rock the player applies partial head damage and advances the round', () => {
    // High chin (99 → ROCKED 55) means gpDmg 23 is not a rock → partial damage, round advances.
    const player = { ...ARCHETYPES.striker, striking: 1, takedownDef: 1, submissionDef: 58, chin: 99 };
    const s = startFight({ seed: 'opp-partial', fightNumber: 1, playerStatLine: player, opponent: wrestlerOpp() });
    const r = resolveRound(s, strike('head', 'pickApart'));
    expect(r.phase).toBe('corner');
    expect(r.window).toBeNull();
    expect(r.player.headDamage).toBe(23); // partial GnP damage carried forward
    expect(r.round).toBe(2); // no finish → round advanced normally
    expect(r.opponent.roundScore).toBeGreaterThan(0); // opponent won the round
  });

  // ── Phase-guard completeness: resolveRound (mirror finishStep) ────────────────
  it('resolveRound throws unless the fight is in-round', () => {
    const base = start();
    expect(() => resolveRound({ ...base, phase: 'finish-window' }, strike('head', 'pickApart'))).toThrow();
    expect(() => resolveRound({ ...base, phase: 'finished' }, strike('head', 'pickApart'))).toThrow();
  });
});

describe('M14: corner + game-plan', () => {
  const PLAYER = buildStatLine(getFighter('georges-st-pierre'));

  function makeState(round = 1, totalRounds = 3): FightState {
    const seed = 'test-corner-seed';
    const opponent = generateOpponent(seed, 1);
    const state = startFight({ seed, fightNumber: 1, playerStatLine: PLAYER, opponent });
    return { ...state, round, rounds: totalRounds };
  }

  it('(a) normal non-terminal resolveRound → phase=corner, round advances, lastReport set', () => {
    // verified: 'test-corner-seed' always produces corner at round 1 with GSP vs generated opponent
    const s0 = makeState();
    const s1 = resolveRound(s0, { kind: 'strike', target: 'head', tactic: 'pickApart' });
    expect(s1.phase).toBe('corner');
    expect(s1.window).toBeNull();
    expect(s1.lastReport).not.toBeNull();
    expect(s1.round).toBe(2);
    expect(s1.gamePlan).toBeNull();
  });

  it('(b) chooseGamePlan from corner sets gamePlan and phase', () => {
    // verified: 'test-corner-seed' always produces corner at round 1 with GSP vs generated opponent
    const s0 = makeState();
    const s1 = resolveRound(s0, { kind: 'strike', target: 'head', tactic: 'pickApart' });
    expect(s1.phase).toBe('corner');
    const s2 = chooseGamePlan(s1, 'push-pace');
    expect(s2.phase).toBe('in-round');
    expect(s2.gamePlan).toBe('push-pace');
  });

  it('(b) chooseGamePlan throws when not in corner', () => {
    const s0 = makeState();
    expect(() => chooseGamePlan(s0, 'push-pace')).toThrow('corner');
  });

  it('(c) push-pace raises player damage output vs null plan', () => {
    const seed = 'gameplan-test-seed';
    const opponent = generateOpponent(seed, 1);
    const s0null = startFight({ seed, fightNumber: 1, playerStatLine: PLAYER, opponent });
    const s0push = { ...s0null, gamePlan: 'push-pace' as const };

    const intent: RoundIntent = { kind: 'strike', target: 'head', tactic: 'pressure' };
    const rNull = resolveRound(s0null, intent);
    const rPush = resolveRound(s0push, intent);

    const oppDmgNull = rNull.opponent.headDamage + rNull.opponent.bodyDamage;
    const oppDmgPush = rPush.opponent.headDamage + rPush.opponent.bodyDamage;
    expect(oppDmgPush).toBeGreaterThanOrEqual(oppDmgNull);
  });

  it('(d) catch-breath gives more post-stamina than null plan', () => {
    const seed = 'gameplan-test-seed';
    const opponent = generateOpponent(seed, 1);
    const s0null = startFight({ seed, fightNumber: 1, playerStatLine: PLAYER, opponent });
    const s0catch = { ...s0null, gamePlan: 'catch-breath' as const };

    const intent: RoundIntent = { kind: 'strike', target: 'head', tactic: 'counter' };
    const rNull = resolveRound(s0null, intent);
    const rCatch = resolveRound(s0catch, intent);

    expect(rCatch.player.stamina).toBeGreaterThanOrEqual(rNull.player.stamina);
  });

  it('(e) work-body routes damage to body on a head strike', () => {
    const seed = 'gameplan-test-seed';
    const opponent = generateOpponent(seed, 1);
    const s0null = startFight({ seed, fightNumber: 1, playerStatLine: PLAYER, opponent });
    const s0body = { ...s0null, gamePlan: 'work-body' as const };

    const intent: RoundIntent = { kind: 'strike', target: 'head', tactic: 'pressure' };
    const rNull = resolveRound(s0null, intent);
    const rBody = resolveRound(s0body, intent);

    expect(rNull.opponent.headDamage).toBeGreaterThan(0);  // fixture must land damage
    expect(rBody.opponent.bodyDamage).toBeGreaterThan(0);   // body routing applied
    expect(rBody.opponent.bodyDamage).toBeGreaterThanOrEqual(rNull.opponent.bodyDamage);
  });

  it('(f) round 1 with gamePlan:null is the pre-M14 golden master (frozen literals)', () => {
    // gamePlanEffect(null) = {atkMult:1,defMult:1,staminaDelta:0,forceBodyTarget:false} — identity.
    // Combat numbers (damage, stamina, roundScore) are byte-for-byte identical to origin/main's
    // pre-M14 resolveRound. phase differs: M14 routes to 'corner', pre-M14 to 'in-round'.
    const seed = 'determinism-guard';
    const opponent = generateOpponent(seed, 1);
    const s0 = startFight({ seed, fightNumber: 1, playerStatLine: PLAYER, opponent });
    expect(s0.gamePlan).toBeNull();
    expect(s0.lastReport).toBeNull(); // startFight must not pre-populate lastReport
    const intent: RoundIntent = { kind: 'strike', target: 'head', tactic: 'pickApart' };
    const result = resolveRound(s0, intent);

    // ── Frozen golden-master literals ──
    expect(result.player.headDamage).toBe(0);
    expect(result.player.bodyDamage).toBe(0);
    expect(result.player.stamina).toBe(100);
    expect(result.player.roundScore).toBe(3);
    expect(result.opponent.headDamage).toBe(14);
    expect(result.opponent.bodyDamage).toBe(0);
    expect(result.opponent.stamina).toBe(100);
    expect(result.opponent.roundScore).toBe(0);
    expect(result.phase).toBe('corner');    // M14: corner; pre-M14 was 'in-round'
    expect(result.round).toBe(2);
  });
});
