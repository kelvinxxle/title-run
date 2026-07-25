/**
 * M19-C — per-strike choreography.
 *
 * The bug this file exists to prevent: `timeline.ts` used to select load/contact poses by
 * *family* (`punch` | `kick`), so jab ≡ powerPunch ≡ elbow and legKick ≡ bodyKick ≡ knee played
 * byte-identical choreography. A per-move test would not have caught that — only a pairwise
 * comparison across ALL six strikes does. That is the first test below; keep it.
 */
import { describe, it, expect } from 'vitest';
import { buildBeatTimeline } from './timeline';
import { RIG_POSES } from './rigPoses';
import type { RigPose } from './rigPoses';
import { buildResolvedBeat } from '../domain/combat/beat';
import type { BeatOutcome, ResolvedBeat } from '../domain/combat/beat';
import { STRIKE_PALETTE, STRIKES, type StrikeId } from '../domain/combat/strikes';
import { simulateFight } from './simulateFight';
import type { ExchangeMove } from '../domain/combat/intents';

const SEED = 'm19c-choreo';

function strikeBeat(id: StrikeId, outcome: BeatOutcome): ResolvedBeat {
  const target = STRIKES[id].target;
  const landed = outcome === 'landed';
  return buildResolvedBeat({
    round: 1, exchange: 1, winner: 'player', dominance: 4,
    moveClass: 'strike', moveId: id, outcome, target,
    deltas: {
      playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
      opponentHead: landed && target === 'head' ? 14 : 0,
      opponentBody: landed && target === 'body' ? 14 : 0,
      opponentLeg: landed && target === 'legs' ? 14 : 0,
      opponentStamina: 2,
    },
    status: {
      playerBecameRocked: false, opponentBecameRocked: false,
      playerGassed: false, opponentGassed: false,
    },
    signatureId: null, isFinish: false, finishMethod: null,
  });
}

/** The actor's pose sequence + the full event timing sequence — i.e. what the player actually sees. */
function choreography(id: StrikeId, outcome: BeatOutcome): { poses: string; timing: string } {
  const beat = strikeBeat(id, outcome);
  const { events } = buildBeatTimeline(beat, SEED);
  return {
    poses: events
      .filter((e) => e.actor === beat.actorId && e.pose != null)
      .map((e) => e.pose)
      .join('>'),
    timing: events.map((e) => `${e.kind}@${e.tMs}+${e.durMs}`).join('|'),
  };
}

describe('M19-C: every strike is choreographed distinctly', () => {
  // `landed` is the only shape the domain emits for strikes (proven by the
  // "production-reachable beat shapes" suite below). `blocked` and `evaded` are contract-level
  // only — they guard buildBeatTimeline's other branches against regressing to family keying,
  // but they are NOT evidence of on-screen behaviour. Do not read them as such.
  for (const outcome of ['landed', 'blocked', 'evaded'] as const) {
    const scope = outcome === 'landed' ? 'production' : 'contract-only, not domain-reachable';
    it(`all six strikes produce pairwise-distinct (pose sequence, timing) on a ${outcome} beat [${scope}]`, () => {
      const collisions: string[] = [];

      for (const a of STRIKE_PALETTE) {
        for (const b of STRIKE_PALETTE) {
          if (a === b) continue;
          const ca = choreography(a, outcome);
          const cb = choreography(b, outcome);
          const samePoses = ca.poses === cb.poses;
          const sameTiming = ca.timing === cb.timing;
          if (samePoses && sameTiming) {
            collisions.push(`${a} vs ${b}: identical poses [${ca.poses}] AND identical timing [${ca.timing}]`);
          }
        }
      }

      expect(collisions, `\ncolliding strike pairs:\n${collisions.join('\n')}\n`).toEqual([]);
    });
  }

  it('pose sequences alone (ignoring timing) are pairwise-distinct on a landed beat', () => {
    const collisions: string[] = [];
    for (const a of STRIKE_PALETTE) {
      for (const b of STRIKE_PALETTE) {
        if (a === b) continue;
        const pa = choreography(a, 'landed').poses;
        const pb = choreography(b, 'landed').poses;
        if (pa === pb) collisions.push(`${a} vs ${b}: both play [${pa}]`);
      }
    }
    expect(collisions, `\nstrikes sharing a pose sequence:\n${collisions.join('\n')}\n`).toEqual([]);
  });

  it('timing signatures alone (ignoring poses) are pairwise-distinct on a landed beat', () => {
    const collisions: string[] = [];
    for (const a of STRIKE_PALETTE) {
      for (const b of STRIKE_PALETTE) {
        if (a === b) continue;
        const ta = choreography(a, 'landed').timing;
        const tb = choreography(b, 'landed').timing;
        if (ta === tb) collisions.push(`${a} vs ${b}: both run [${ta}]`);
      }
    }
    expect(collisions, `\nstrikes sharing a timing signature:\n${collisions.join('\n')}\n`).toEqual([]);
  });
});

describe('M19-C: timing signatures read as intended', () => {
  function windup(id: StrikeId): number {
    const { events } = buildBeatTimeline(strikeBeat(id, 'landed'), SEED);
    return events.find((e) => e.kind === 'windup')!.durMs;
  }
  function total(id: StrikeId): number {
    return buildBeatTimeline(strikeBeat(id, 'landed'), SEED).totalMs;
  }

  it('the jab snaps: shortest windup and shortest total of all six strikes', () => {
    for (const id of STRIKE_PALETTE) {
      if (id === 'jab') continue;
      expect(windup('jab'), `jab windup vs ${id}`).toBeLessThan(windup(id));
      expect(total('jab'), `jab total vs ${id}`).toBeLessThan(total(id));
    }
  });

  it('the power punch telegraphs: longest windup of all six strikes', () => {
    for (const id of STRIKE_PALETTE) {
      if (id === 'powerPunch') continue;
      expect(windup('powerPunch'), `powerPunch windup vs ${id}`).toBeGreaterThan(windup(id));
    }
  });

  it('the power punch lands heavy: longer strike + reaction than the jab', () => {
    const ev = (id: StrikeId, kind: string) =>
      buildBeatTimeline(strikeBeat(id, 'landed'), SEED).events.find((e) => e.kind === kind)!;
    expect(ev('powerPunch', 'strike').durMs).toBeGreaterThan(ev('jab', 'strike').durMs);
    expect(ev('powerPunch', 'reaction').durMs).toBeGreaterThan(ev('jab', 'reaction').durMs);
  });

  it('timing is deterministic — no presentation RNG leaks into strike durations', () => {
    for (const id of STRIKE_PALETTE) {
      const a = buildBeatTimeline(strikeBeat(id, 'landed'), 'seed-A');
      const b = buildBeatTimeline(strikeBeat(id, 'landed'), 'seed-B-totally-different');
      expect(a, `strike ${id} must be seed-independent`).toEqual(b);
    }
  });
});

describe('M19-C: each strike uses its own load + contact pose', () => {
  it('every strike emits a load and a contact pose unique to that strike', () => {
    const seen = new Map<string, StrikeId>();
    for (const id of STRIKE_PALETTE) {
      const { events } = buildBeatTimeline(strikeBeat(id, 'landed'), SEED);
      const actorPoses = events.filter((e) => e.actor === 'player' && e.pose != null).map((e) => e.pose!);
      const load = actorPoses[0];
      const contact = actorPoses[1];
      expect(load, `${id} load pose`).toBeDefined();
      expect(contact, `${id} contact pose`).toBeDefined();
      for (const p of [load, contact]) {
        const owner = seen.get(p);
        expect(owner, `pose "${p}" is shared by ${owner} and ${id}`).toBeUndefined();
        seen.set(p, id);
      }
    }
  });

  it('non-strike move classes still fall back to the punch family', () => {
    const advance = buildResolvedBeat({
      round: 1, exchange: 1, winner: 'player', dominance: 2,
      moveClass: 'counter', moveId: null, outcome: 'landed', target: 'head',
      deltas: { playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
                opponentHead: 10, opponentBody: 0, opponentLeg: 0, opponentStamina: 1 },
      status: { playerBecameRocked: false, opponentBecameRocked: false, playerGassed: false, opponentGassed: false },
      signatureId: null, isFinish: false, finishMethod: null,
    });
    const actorPoses = buildBeatTimeline(advance, SEED).events
      .filter((e) => e.actor === 'player' && e.pose != null).map((e) => e.pose);
    expect(actorPoses).toContain('punch-load');
    expect(actorPoses).toContain('punch-contact');
  });
});

describe('M19-C: rig geometry is distinct, not just pose names', () => {
  const LOADS = ['jab-load', 'powerPunch-load', 'elbow-load', 'legKick-load', 'bodyKick-load', 'knee-load'] as const;
  const CONTACTS = ['jab-contact', 'powerPunch-contact', 'elbow-contact', 'legKick-contact', 'bodyKick-contact', 'knee-contact'] as const;

  function geo(name: string): string {
    return JSON.stringify(RIG_POSES[name as keyof typeof RIG_POSES]);
  }

  it('all 12 per-strike rig poses are articulated (every joint present and numeric)', () => {
    for (const n of [...LOADS, ...CONTACTS]) {
      const p: RigPose = RIG_POSES[n];
      expect(p, `RIG_POSES["${n}"] missing`).toBeDefined();
      for (const j of ['torso', 'head', 'armLead', 'foreLead', 'armRear', 'foreRear',
                       'thighLead', 'shinLead', 'thighRear', 'shinRear', 'bodyY', 'rigX'] as const) {
        expect(typeof p[j], `RIG_POSES["${n}"].${j}`).toBe('number');
      }
    }
  });

  it('the six contact poses have pairwise-distinct geometry', () => {
    const collisions: string[] = [];
    for (const a of CONTACTS) for (const b of CONTACTS) {
      if (a !== b && geo(a) === geo(b)) collisions.push(`${a} === ${b}`);
    }
    expect(collisions, `\nidentical contact geometry:\n${collisions.join('\n')}\n`).toEqual([]);
  });

  it('the six load poses have pairwise-distinct geometry', () => {
    const collisions: string[] = [];
    for (const a of LOADS) for (const b of LOADS) {
      if (a !== b && geo(a) === geo(b)) collisions.push(`${a} === ${b}`);
    }
    expect(collisions, `\nidentical load geometry:\n${collisions.join('\n')}\n`).toEqual([]);
  });
});

describe('M19-C: each pose reads as the move it represents', () => {
  const guard = RIG_POSES.guard;

  it('jab throws the LEAD arm; power punch throws the REAR arm', () => {
    const jab = RIG_POSES['jab-contact'];
    const power = RIG_POSES['powerPunch-contact'];
    // "thrown" = upper arm swung out AND forearm straightened (low bend angle)
    expect(jab.armLead).toBeGreaterThan(guard.armLead);
    expect(jab.foreLead).toBeLessThan(30);
    expect(power.armRear).toBeGreaterThan(guard.armRear);
    expect(power.foreRear).toBeLessThan(30);
    // and each keeps its OTHER hand back in guard
    expect(jab.foreRear).toBeGreaterThan(60);
    expect(power.foreLead).toBeGreaterThan(60);
  });

  it('power punch rotates the torso and commits far harder than the jab', () => {
    expect(RIG_POSES['powerPunch-contact'].torso).toBeGreaterThan(RIG_POSES['jab-contact'].torso + 12);
    expect(RIG_POSES['powerPunch-load'].torso).toBeLessThan(RIG_POSES['jab-load'].torso - 12);
  });

  it('elbow keeps the arm BENT at contact (short arc) unlike the extended jab', () => {
    expect(RIG_POSES['elbow-contact'].foreLead).toBeGreaterThan(60);
    expect(RIG_POSES['elbow-contact'].foreLead).toBeGreaterThan(RIG_POSES['jab-contact'].foreLead);
  });

  it('elbow and knee close the distance more than the long-range strikes', () => {
    for (const close of ['elbow-contact', 'knee-contact'] as const) {
      for (const far of ['jab-contact', 'legKick-contact', 'bodyKick-contact'] as const) {
        expect(RIG_POSES[close].rigX, `${close} vs ${far} range`).toBeLessThan(RIG_POSES[far].rigX);
      }
    }
  });

  it('body kick lands clearly higher than the leg kick, which stays low', () => {
    expect(RIG_POSES['legKick-contact'].thighRear).toBeGreaterThan(guard.thighRear);
    expect(RIG_POSES['bodyKick-contact'].thighRear)
      .toBeGreaterThan(RIG_POSES['legKick-contact'].thighRear + 20);
  });

  it('both round kicks counter-lean the torso away; the body kick leans further', () => {
    expect(RIG_POSES['legKick-contact'].torso).toBeLessThan(guard.torso);
    expect(RIG_POSES['bodyKick-contact'].torso).toBeLessThan(RIG_POSES['legKick-contact'].torso);
  });

  it('knee drives vertically with the shin FOLDED BACK — no outward leg extension', () => {
    const knee = RIG_POSES['knee-contact'];
    expect(knee.thighRear).toBeGreaterThan(RIG_POSES['bodyKick-contact'].thighRear);
    expect(knee.shinRear).toBeLessThan(-60);                       // folded back hard
    expect(knee.shinRear).toBeLessThan(RIG_POSES['bodyKick-contact'].shinRear); // kicks extend, knees don't
  });

  it('every strike chambers before it fires (load differs from contact for all six)', () => {
    for (const id of STRIKE_PALETTE) {
      expect(JSON.stringify(RIG_POSES[`${id}-load` as keyof typeof RIG_POSES]))
        .not.toEqual(JSON.stringify(RIG_POSES[`${id}-contact` as keyof typeof RIG_POSES]));
    }
  });
});

/**
 * M19-C follow-up (independent review finding).
 *
 * The pairwise suite above builds beats by hand, so it proves the *function's* contract but
 * says nothing about which beat shapes the domain actually emits. Simulation over 400 fights
 * shows only three reachable shapes:
 *
 *     988  strike   | landed | moveId=set     <- the six strikes, choreographed above
 *     114  takedown | evaded | moveId=NULL    <- own branch (M19-B neutral level-change)
 *       7  takedown | landed | moveId=set
 *
 * `strike|evaded` and `strike|blocked` are NEVER emitted, so the two loop iterations above are
 * contract-level only. The one shape they do NOT cover is the finishing blow, which is the most
 * watched beat in the game.
 */
describe('M19-C: production-reachable beat shapes', () => {
  it('every strike beat the domain actually emits is landed and carries a moveId', () => {
    const shapes = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const script = Array.from({ length: 24 }, (_, k) => ({
        kind: 'strike' as const, strike: STRIKE_PALETTE[(i + k) % STRIKE_PALETTE.length],
      }));
      for (const b of simulateFight(`reach-${i}`, script).beats) {
        if (b.moveClass !== 'strike') continue;
        shapes.add(`${b.outcome}|moveId=${b.moveId === null ? 'NULL' : 'set'}`);
        if (b.moveId !== null) seen.add(b.moveId);
      }
    }
    expect([...shapes]).toEqual(['landed|moveId=set']);
    expect([...seen].sort()).toEqual([...STRIKE_PALETTE].sort());
  });

  it('all six strikes are pairwise-distinct on REAL domain-emitted beats, not just hand-built ones', () => {    const real = new Map<string, ResolvedBeat>();
    for (let i = 0; i < 60 && real.size < STRIKE_PALETTE.length; i++) {
      const script = Array.from({ length: 24 }, (_, k) => ({
        kind: 'strike' as const, strike: STRIKE_PALETTE[(i + k) % STRIKE_PALETTE.length],
      }));
      for (const b of simulateFight(`realchoreo-${i}`, script).beats) {
        if (b.moveClass === 'strike' && b.moveId !== null && !real.has(b.moveId)) real.set(b.moveId, b);
      }
    }
    expect([...real.keys()].sort()).toEqual([...STRIKE_PALETTE].sort());

    const sig = (b: ResolvedBeat) => {
      const { events } = buildBeatTimeline(b, SEED);
      const poses = events.filter((e) => e.actor === b.actorId && e.pose != null).map((e) => e.pose).join('>');
      return `${poses}##${events.map((e) => `${e.kind}@${e.tMs}+${e.durMs}`).join('|')}`;
    };
    const collisions: string[] = [];
    for (const [a, ba] of real) {
      for (const [b, bb] of real) {
        if (a >= b) continue;
        if (sig(ba) === sig(bb)) collisions.push(`${a} vs ${b}: ${sig(ba)}`);
      }
    }
    expect(collisions, `\ncolliding REAL beats:\n${collisions.join('\n')}\n`).toEqual([]);
  });

  /**
   * The dominant takedown shape in production is `moveId: null` + `outcome: 'evaded'` (114 of 121
   * takedown beats over 400 fights). The M19-B invariant test only ever exercised
   * `moveId: 'single-leg'` + `landed`, so the common shape was uncovered — and it is the one that
   * would fall through to the punch fallback if the takedown branch ever moved after the
   * outcome branches. Pin it at the shape the domain actually emits.
   */
  it('real (moveId-less, evaded) takedown beats still use neutral choreography — no punch poses', () => {
    const pool: ExchangeMove[] = [
      ...STRIKE_PALETTE.map((s) => ({ kind: 'strike' as const, strike: s })),
      { kind: 'takedown' as const, takedownType: 'double-leg' as const },
      { kind: 'takedown' as const, takedownType: 'single-leg' as const },
    ];
    const real: ResolvedBeat[] = [];
    for (let i = 0; i < 40; i++) {
      const script = Array.from({ length: 30 }, (_, k) => pool[(i * 5 + k * 3) % pool.length]);
      for (const b of simulateFight(`td-${i}`, script).beats) {
        if (b.moveClass === 'takedown' && b.moveId === null && b.outcome === 'evaded') real.push(b);
      }
    }
    expect(real.length).toBeGreaterThan(0);
    for (const b of real) {
      const poses = buildBeatTimeline(b, SEED).events.map((e) => e.pose).filter(Boolean);
      expect(poses).not.toContain('punch-load');
      expect(poses).not.toContain('punch-contact');
      expect(poses).not.toContain('finish-load');
    }
  });
});

/**
 * The finishing blow. `finishStep` takes 'commit' | 'measure' | 'hold' — it is NOT one of the six
 * palette strikes, so `moveId: null` is semantically correct and must not be faked. But that made
 * the KO land on the generic punch fallback: the single most watched beat in the game played the
 * most anonymous animation in the game. It gets its own read.
 */
function finishBeat(): ResolvedBeat {
  // Mirrors src/domain/combat/finish.ts exactly, including the all-zero deltas.
  return buildResolvedBeat({
    round: 3, exchange: 1, winner: 'player', dominance: 10,
    moveClass: 'strike', moveId: null, target: 'head', outcome: 'landed',
    deltas: {
      opponentHead: 0, opponentBody: 0, opponentLeg: 0, opponentStamina: 0,
      playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
    },
    status: {
      opponentBecameRocked: false, playerBecameRocked: false,
      opponentGassed: false, playerGassed: false,
    },
    signatureId: null, isFinish: true, finishMethod: 'KO',
  });
}

function poseSeq(b: ResolvedBeat): string[] {
  return buildBeatTimeline(b, SEED).events
    .filter((e) => e.actor === b.actorId && e.pose != null)
    .map((e) => e.pose as string);
}

describe('M19-C: the finishing blow is choreographed, not defaulted', () => {
  it('does not play the anonymous punch fallback', () => {
    const poses = poseSeq(finishBeat());
    expect(poses).not.toContain('punch-load');
    expect(poses).not.toContain('punch-contact');
  });

  it('reads differently from an ordinary moveId-less punch beat', () => {
    const ordinary = buildResolvedBeat({
      ...JSON.parse(JSON.stringify({
        round: 3, exchange: 1, winner: 'player', dominance: 10,
        moveClass: 'strike', moveId: null, target: 'head', outcome: 'landed',
        deltas: {
          opponentHead: 0, opponentBody: 0, opponentLeg: 0, opponentStamina: 0,
          playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
        },
        status: {
          opponentBecameRocked: false, playerBecameRocked: false,
          opponentGassed: false, playerGassed: false,
        },
        signatureId: null, isFinish: false, finishMethod: null,
      })),
    });
    expect(poseSeq(finishBeat())).not.toEqual(poseSeq(ordinary));
  });

  it('is the biggest telegraph in the game — longer windup than any single strike', () => {
    const windup = (b: ResolvedBeat) => buildBeatTimeline(b, SEED).events.find((e) => e.kind === 'windup')!.durMs;
    const longestStrike = Math.max(...STRIKE_PALETTE.map((id) => windup(strikeBeat(id, 'landed'))));
    expect(windup(finishBeat())).toBeGreaterThan(longestStrike);
  });

  it('still appends the M19-B knockdown + finishing hitstop', () => {
    const { events } = buildBeatTimeline(finishBeat(), SEED);
    expect(events.some((e) => e.kind === 'knockdown' && e.pose === 'down')).toBe(true);
    expect(events.filter((e) => e.kind === 'hitstop').length).toBeGreaterThanOrEqual(1);
  });

  it('does not hijack a finish that DOES carry a strike id — the strike keeps its identity', () => {
    const koJab = buildResolvedBeat({
      round: 3, exchange: 1, winner: 'player', dominance: 10,
      moveClass: 'strike', moveId: 'jab', target: 'head', outcome: 'landed',
      deltas: {
        opponentHead: 30, opponentBody: 0, opponentLeg: 0, opponentStamina: 0,
        playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
      },
      status: {
        opponentBecameRocked: true, playerBecameRocked: false,
        opponentGassed: false, playerGassed: false,
      },
      signatureId: null, isFinish: true, finishMethod: 'KO',
    });
    expect(poseSeq(koJab)).toContain('jab-load');
    expect(poseSeq(koJab)).toContain('jab-contact');
  });
});
