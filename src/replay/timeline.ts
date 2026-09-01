import type { ResolvedBeat, BeatActor } from '../domain/combat/beat';
import type { PoseName } from './poses';
import type { StrikeId } from '../domain/combat/strikes';
import { moveFamily } from './moveFamily';

export type BeatEventKind =
  | 'windup' | 'strike' | 'slip' | 'impact' | 'block' | 'reaction' | 'knockdown' | 'recover'
  | 'flash' | 'hitstop' | 'shake';

export interface BeatEvent {
  tMs: number;
  durMs: number;
  kind: BeatEventKind;
  actor: BeatActor;
  pose?: PoseName;
  intensity?: number;
  zone?: 'head' | 'body' | 'legs';
}

export interface BeatTimeline { totalMs: number; events: BeatEvent[] }

export function computeFinalPose(events: BeatEvent[], actor: BeatActor): PoseName {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.actor === actor && e.pose != null) return e.pose;
  }
  return 'idle';
}

function toZone(target: 'head' | 'body' | 'legs' | null): 'head' | 'body' | 'legs' {
  if (target === 'legs') return 'legs';
  if (target === 'head') return 'head';
  return 'body';
}

/**
 * Per-move choreography: which poses play, and the rhythm they play at.
 *
 * Timing is as strong a readability lever as pose — a jab that takes as long to arrive as a
 * power punch reads as the same move no matter how the rig is posed. All values are constants
 * (no presentation RNG) so feel-gate captures are byte-reproducible.
 */
interface Choreography {
  load: PoseName;
  contact: PoseName;
  windupMs: number;
  strikeMs: number;
  impactMs: number;
  reactionMs: number;
  recoverMs: number;
  /** Post-contact freeze. 0 = none; heavier strikes bite into the clock. */
  hitstopMs: number;
  /** Scales the camera shake for a given damage delta — heavy strikes rattle harder. */
  shakeWeight: number;
}

const STRIKE_CHOREOGRAPHY: Record<StrikeId, Choreography> = {
  // Snaps out and back before the eye settles — shortest windup and shortest beat of the six.
  jab:        { load: 'jab-load',        contact: 'jab-contact',        windupMs: 34,  strikeMs: 46, impactMs: 44, reactionMs: 72,  recoverMs: 84,  hitstopMs: 0,  shakeWeight: 0.45 },
  // Telegraphed: the longest coil in the game, then the heaviest landing.
  powerPunch: { load: 'powerPunch-load', contact: 'powerPunch-contact', windupMs: 152, strikeMs: 96, impactMs: 74, reactionMs: 130, recoverMs: 110, hitstopMs: 70, shakeWeight: 1.0  },
  // Short travel from close range — quick in, sharp bite, brisk recovery.
  elbow:      { load: 'elbow-load',      contact: 'elbow-contact',      windupMs: 58,  strikeMs: 52, impactMs: 52, reactionMs: 96,  recoverMs: 96,  hitstopMs: 40, shakeWeight: 0.8  },
  // Whipping arc: a longer swing than any punch, but no freeze — it thuds, it doesn't stun.
  legKick:    { load: 'legKick-load',    contact: 'legKick-contact',    windupMs: 82,  strikeMs: 72, impactMs: 58, reactionMs: 104, recoverMs: 112, hitstopMs: 0,  shakeWeight: 0.65 },
  // Bigger chamber and a bigger arc than the leg kick, so it takes visibly longer to arrive.
  bodyKick:   { load: 'bodyKick-load',   contact: 'bodyKick-contact',   windupMs: 116, strikeMs: 86, impactMs: 66, reactionMs: 126, recoverMs: 118, hitstopMs: 55, shakeWeight: 0.9  },
  // Short vertical drive from the clinch — compact windup, blunt landing.
  knee:       { load: 'knee-load',       contact: 'knee-contact',       windupMs: 68,  strikeMs: 62, impactMs: 62, reactionMs: 112, recoverMs: 104, hitstopMs: 45, shakeWeight: 0.85 },
};

/**
 * Fallback for beats that carry no StrikeId (advance/evade/counter/impact/knockdown and any
 * non-strike moveId). Values are the pre-M19-C uniform timings, so those beats are unchanged.
 */
const FAMILY_CHOREOGRAPHY: Record<'punch' | 'kick', Choreography> = {
  punch: { load: 'punch-load', contact: 'punch-contact', windupMs: 70, strikeMs: 80, impactMs: 60, reactionMs: 100, recoverMs: 120, hitstopMs: 0, shakeWeight: 0.7 },
  kick:  { load: 'kick-load',  contact: 'kick-contact',  windupMs: 70, strikeMs: 80, impactMs: 60, reactionMs: 100, recoverMs: 120, hitstopMs: 0, shakeWeight: 0.7 },
};

/**
 * The finishing blow. `finishStep` resolves a 'commit' decision, not a palette strike, so its beat
 * legitimately carries `moveId: null` — but that used to drop the most-watched beat in the game
 * onto the anonymous punch fallback. It gets the biggest telegraph and the heaviest landing.
 * Only used when the beat carries NO strike id: a finish that names its strike keeps that identity.
 */
const FINISH_CHOREOGRAPHY: Choreography = {
  load: 'finish-load', contact: 'finish-contact',
  windupMs: 168, strikeMs: 104, impactMs: 84, reactionMs: 140, recoverMs: 120, hitstopMs: 90, shakeWeight: 1.0,
};

function choreographyFor(moveId: string | null, strikeFam: 'punch' | 'kick', isFinish: boolean): Choreography {
  if (moveId !== null && Object.prototype.hasOwnProperty.call(STRIKE_CHOREOGRAPHY, moveId)) {
    return STRIKE_CHOREOGRAPHY[moveId as StrikeId];
  }
  if (isFinish) return FINISH_CHOREOGRAPHY;
  return FAMILY_CHOREOGRAPHY[strikeFam];
}

function targetBecameRocked(beat: ResolvedBeat): boolean {
  return beat.targetId === 'opponent'
    ? beat.status.opponentBecameRocked
    : beat.status.playerBecameRocked;
}

export function buildBeatTimeline(beat: ResolvedBeat, presentationSeed: string): BeatTimeline {
  // Reserved: the presentation seed is part of the public playback contract, but every duration
  // below is a per-move constant so feel-gate captures replay identically run to run.
  void presentationSeed;
  const events: BeatEvent[] = [];
  let t = 0;

  const family = moveFamily(beat.moveId, beat.moveClass);
  const strikeFam: 'punch' | 'kick' = family === 'kick' ? 'kick' : 'punch';
  const chor = choreographyFor(beat.moveId, strikeFam, beat.isFinish);

  function push(
    kind: BeatEventKind,
    dur: number,
    actor: BeatActor,
    opts?: { pose?: PoseName; intensity?: number; zone?: 'head' | 'body' | 'legs' },
  ): void {
    events.push({ tMs: t, durMs: dur, kind, actor, ...opts });
    t += dur;
  }

  if (beat.moveClass === 'signature' && beat.signatureId !== null) {
    // Opponent telegraphs the cross (windup) → actor slips → actor loads and fires signature → impact → target reacts
    const sigReactionPose: PoseName = targetBecameRocked(beat) ? 'reel' : 'hit-head';
    push('windup', 80, beat.targetId, { pose: 'cross' });
    push('slip', 120, beat.actorId, { pose: 'slip' });
    push('strike', 60, beat.actorId, { pose: 'sig-load' });
    push('strike', 80, beat.actorId, { pose: 'sig-fire' });
    push('impact', 60, beat.targetId, { zone: 'head', intensity: 1 });
    push('flash', 40, beat.targetId, { zone: 'head', intensity: 1 });
    push('hitstop', 120, beat.actorId);
    push('shake', 60, beat.actorId, { intensity: 0.9 });
    push('reaction', 120, beat.targetId, { pose: sigReactionPose });
    if (beat.isFinish) {
      push('knockdown', 300, beat.targetId, { pose: 'down' });
    }
    push('recover', 120, beat.actorId, { pose: 'idle' });

  } else if (family === 'takedown') {
    // Neutral level-change + clinch — no punch/kick poses, no flash for damageless takes
    push('windup', 80, beat.actorId, { pose: 'guard' });
    push('strike', 100, beat.actorId, { pose: 'slip' }); // actor shoots/dips
    push('block', 80, beat.targetId, { pose: 'guard' }); // target defends/braces
    if (beat.isFinish) {
      push('knockdown', 300, beat.targetId, { pose: 'down' });
    }
    push('recover', 120, beat.actorId, { pose: 'idle' });

  } else if (beat.outcome === 'evaded') {
    push('windup', chor.windupMs, beat.actorId, { pose: chor.load });
    push('slip', 100, beat.targetId, { pose: 'slip' });
    push('recover', 100, beat.actorId, { pose: 'idle' });

  } else if (beat.outcome === 'blocked') {
    push('windup', chor.windupMs, beat.actorId, { pose: chor.load });
    push('strike', chor.strikeMs, beat.actorId, { pose: chor.contact });
    push('block', 80, beat.targetId, { pose: 'guard' });
    push('shake', 40, beat.actorId, { intensity: 0.3 });
    push('recover', 100, beat.actorId, { pose: 'idle' });

  } else {
    // strike + landed (or countered non-signature)
    const zone = toZone(beat.target);
    const rawDelta = zone === 'head'
      ? (beat.targetId === 'opponent' ? beat.deltas.opponentHead : beat.deltas.playerHead)
      : zone === 'legs'
        ? (beat.targetId === 'opponent' ? beat.deltas.opponentLeg : beat.deltas.playerLeg)
        : (beat.targetId === 'opponent' ? beat.deltas.opponentBody : beat.deltas.playerBody);
    const intensity = Math.min(1, rawDelta / 30);
    const reactionPose: PoseName = targetBecameRocked(beat)
      ? 'reel'
      : zone === 'legs' ? 'hit-leg'
      : zone === 'head' ? 'hit-head'
      : 'hit-body';

    push('windup', chor.windupMs, beat.actorId, { pose: chor.load });
    push('strike', chor.strikeMs, beat.actorId, { pose: chor.contact });
    push('impact', chor.impactMs, beat.targetId, { zone, intensity });
    push('flash', 40, beat.targetId, { zone, intensity });
    if (chor.hitstopMs > 0) {
      push('hitstop', chor.hitstopMs, beat.actorId);
    }
    push('shake', 50, beat.actorId, { intensity: intensity * chor.shakeWeight });
    push('reaction', chor.reactionMs, beat.targetId, { pose: reactionPose });

    if (beat.isFinish) {
      push('knockdown', 300, beat.targetId, { pose: 'down' });
      push('hitstop', 150, beat.actorId);
    }

    push('recover', chor.recoverMs, beat.actorId, { pose: 'idle' });
  }

  return { totalMs: t, events };
}
