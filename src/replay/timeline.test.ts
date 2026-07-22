import { describe, it, expect } from 'vitest';
import { buildBeatTimeline, computeFinalPose } from './timeline';
import type { ResolvedBeat } from '../domain/combat/beat';
import type { StatLine } from '../domain/combat/stats';

// Fixtures from task brief
const P: StatLine = {
  striking: 80, strikingDef: 70, takedowns: 40, takedownDef: 80,
  submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80,
};
void P; // used for fixture context, not directly in tests

const landedCrossHead: ResolvedBeat = {
  id: '1-1', round: 1, exchange: 1,
  actorId: 'player', targetId: 'opponent',
  moveClass: 'strike', moveId: 'cross', outcome: 'landed', target: 'head',
  deltas: {
    playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: -4,
    opponentHead: 22, opponentBody: 0, opponentLeg: 0, opponentStamina: -2,
  },
  status: {
    playerBecameRocked: false, opponentBecameRocked: false,
    playerGassed: false, opponentGassed: false,
  },
  signatureId: null, isFinish: false, finishMethod: null,
};

const sigCounterLeft: ResolvedBeat = {
  id: '2-3', round: 2, exchange: 3,
  actorId: 'player', targetId: 'opponent',
  moveClass: 'signature', moveId: null, outcome: 'countered', target: 'head',
  deltas: {
    playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
    opponentHead: 45, opponentBody: 0, opponentLeg: 0, opponentStamina: -10,
  },
  status: {
    playerBecameRocked: false, opponentBecameRocked: true,
    playerGassed: false, opponentGassed: false,
  },
  signatureId: 'the-left-hand', isFinish: false, finishMethod: null,
};

const evadedBeat: ResolvedBeat = {
  id: '1-2', round: 1, exchange: 2,
  actorId: 'opponent', targetId: 'player',
  moveClass: 'strike', moveId: 'jab', outcome: 'evaded', target: 'head',
  deltas: {
    playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
    opponentHead: 0, opponentBody: 0, opponentLeg: 0, opponentStamina: -2,
  },
  status: {
    playerBecameRocked: false, opponentBecameRocked: false,
    playerGassed: false, opponentGassed: false,
  },
  signatureId: null, isFinish: false, finishMethod: null,
};

const koFinishBeat: ResolvedBeat = {
  id: '3-3', round: 3, exchange: 3,
  actorId: 'player', targetId: 'opponent',
  moveClass: 'strike', moveId: 'cross', outcome: 'landed', target: 'head',
  deltas: {
    playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: -4,
    opponentHead: 50, opponentBody: 0, opponentLeg: 0, opponentStamina: -5,
  },
  status: {
    playerBecameRocked: false, opponentBecameRocked: true,
    playerGassed: false, opponentGassed: false,
  },
  signatureId: null, isFinish: true, finishMethod: 'KO',
};

describe('buildBeatTimeline', () => {
  it('is deterministic for the same beat + seed', () => {
    const a = buildBeatTimeline(landedCrossHead, 'seed#1');
    const b = buildBeatTimeline(landedCrossHead, 'seed#1');
    expect(a).toEqual(b);
  });

  it('a landed head cross produces windup->strike->impact->flash with impact on opponent at head', () => {
    const t = buildBeatTimeline(landedCrossHead, 'p');
    const kinds = t.events.map(e => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['windup', 'strike', 'impact', 'flash']));
    const impact = t.events.find(e => e.kind === 'impact')!;
    expect(impact.actor).toBe('opponent');
    expect(impact.zone).toBe('head');
  });

  it('the McGregor signature is rhythmically distinct: has a slip + long hitstop, longer than a normal cross', () => {
    const sig = buildBeatTimeline(sigCounterLeft, 'p');
    const cross = buildBeatTimeline(landedCrossHead, 'p');
    expect(sig.events.some(e => e.kind === 'slip')).toBe(true);
    const sigStop = sig.events.find(e => e.kind === 'hitstop')!;
    const crossStop = cross.events.find(e => e.kind === 'hitstop');
    expect(sigStop.durMs).toBeGreaterThan(crossStop?.durMs ?? 0);
    expect(sig.totalMs).toBeGreaterThan(cross.totalMs);
  });

  it('an evaded beat has no flash or knockdown', () => {
    const t = buildBeatTimeline(evadedBeat, 'p');
    expect(t.events.some(e => e.kind === 'flash')).toBe(false);
    expect(t.events.some(e => e.kind === 'knockdown')).toBe(false);
  });

  it('a KO finish appends a knockdown', () => {
    expect(buildBeatTimeline(koFinishBeat, 'p').events.some(e => e.kind === 'knockdown')).toBe(true);
  });

  it('opponent-counter during signature attempt (signatureId null) does NOT play signature choreography', () => {
    const oppCounterBeat: ResolvedBeat = {
      id: '2-2', round: 2, exchange: 2,
      actorId: 'opponent', targetId: 'player',
      moveClass: 'signature', moveId: 'the-left-hand', outcome: 'landed', target: 'head',
      deltas: {
        playerHead: 20, playerBody: 0, playerLeg: 0, playerStamina: -3,
        opponentHead: 0, opponentBody: 0, opponentLeg: 0, opponentStamina: -5,
      },
      status: {
        playerBecameRocked: false, opponentBecameRocked: false,
        playerGassed: false, opponentGassed: false,
      },
      signatureId: null, isFinish: false, finishMethod: null,
    };
    const t = buildBeatTimeline(oppCounterBeat, 'p');
    // Must NOT have a slip event (signature choreography guard)
    expect(t.events.some(e => e.kind === 'slip')).toBe(false);
    // Must NOT have a sig-load pose (opponent should not do McGregor's stance)
    expect(t.events.some(e => (e as { pose?: string }).pose === 'sig-load')).toBe(false);
    // Should fall through to regular strike branch (has windup + impact)
    expect(t.events.some(e => e.kind === 'impact')).toBe(true);
  });
});

// ── H4 RED tests ──────────────────────────────────────────────────────────────

describe('H4: signature timeline sig-fire + target reaction + terminal idle', () => {
  it('H4: signature timeline includes a sig-fire pose event', () => {
    const t = buildBeatTimeline(sigCounterLeft, 'p');
    expect(t.events.some(e => (e as { pose?: string }).pose === 'sig-fire')).toBe(true);
  });

  it('H4: computeFinalPose returns "idle" for player on a signature beat', () => {
    const t = buildBeatTimeline(sigCounterLeft, 'p');
    expect(computeFinalPose(t.events, 'player')).toBe('idle');
  });

  it('H4: computeFinalPose returns "reel" or "hit-head" for opponent on a non-KO rocked signature beat', () => {
    // sigCounterLeft has opponentBecameRocked: true, isFinish: false
    const t = buildBeatTimeline(sigCounterLeft, 'p');
    const pose = computeFinalPose(t.events, 'opponent');
    expect(['reel', 'hit-head']).toContain(pose);
  });
});

// ── I3 RED: computeFinalPose returns 'idle' for the actorId after non-sig beats ─
import { startFight } from '../domain/combat/fightState';
import { resolveExchange } from '../domain/combat/exchange';

describe('I3: idle terminal pose on recover', () => {
  it('I3a — computeFinalPose returns idle for actor on a real landed strike beat', () => {
    // Dominant player (striking=90) vs weak opponent (strikingDef=30) → player always wins.
    const s = startFight({
      seed: 'i3a-seed', fightNumber: 1,
      playerStatLine: { striking: 90, strikingDef: 75, takedowns: 40, takedownDef: 80, submissions: 40, submissionDef: 70, cardio: 80, chin: 75, fightIQ: 80 },
      opponent: { id: 'o', name: 'T', archetype: 'striker', statLine: { striking: 30, strikingDef: 30, takedowns: 20, takedownDef: 30, submissions: 20, submissionDef: 30, cardio: 50, chin: 50, fightIQ: 40 } },
    });
    const after = resolveExchange(s, { kind: 'strike', strike: 'jab' });
    const beat = after.beats.find(b => b.outcome === 'landed' && b.actorId === 'player');
    if (!beat) throw new Error('no landed player beat found with seed i3a-seed');
    const { events } = buildBeatTimeline(beat, 'i3a-pres');
    expect(computeFinalPose(events, 'player')).toBe('idle');
  });

  it('I3b — computeFinalPose returns idle for actor on an evaded beat', () => {
    // Use the existing evadedBeat fixture (actorId=opponent, outcome=evaded)
    const { events } = buildBeatTimeline(evadedBeat, 'i3b-pres');
    expect(computeFinalPose(events, evadedBeat.actorId)).toBe('idle');
  });
});

// ── I6 RED: body-strike flash/shake must have intensity > 0 ──────────────────
describe('I6: body-strike intensity', () => {
  it('I6 — body-strike (bodyKick) beat has flash and shake with intensity > 0', () => {
    // Player.striking=80 vs opponent.strikingDef=30 → player always wins bodyKick exchange.
    const s = startFight({
      seed: 'i6-body-1', fightNumber: 1,
      playerStatLine: { striking: 80, strikingDef: 75, takedowns: 40, takedownDef: 80, submissions: 40, submissionDef: 70, cardio: 80, chin: 75, fightIQ: 80 },
      opponent: { id: 'o', name: 'T', archetype: 'striker', statLine: { striking: 30, strikingDef: 30, takedowns: 20, takedownDef: 40, submissions: 20, submissionDef: 30, cardio: 50, chin: 60, fightIQ: 40 } },
    });
    const after = resolveExchange(s, { kind: 'strike', strike: 'bodyKick' });
    const bodyBeat = after.beats.find(b => b.target === 'body' && b.actorId === 'player' && b.deltas.opponentBody > 0);
    if (!bodyBeat) throw new Error('no body-landed player beat with seed i6-body-1');
    const { events } = buildBeatTimeline(bodyBeat, 'i6-pres');
    const flashEvent = events.find(e => e.kind === 'flash');
    const shakeEvent = events.find(e => e.kind === 'shake');
    expect(flashEvent?.intensity).toBeGreaterThan(0);
    expect(shakeEvent?.intensity).toBeGreaterThan(0);
  });
});
