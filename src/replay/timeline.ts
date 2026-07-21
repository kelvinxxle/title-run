import type { ResolvedBeat, BeatActor } from '../domain/combat/beat';
import type { PoseName } from './poses';
import { createRng } from '../domain/rng';

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
  zone?: 'head' | 'body';
}

export interface BeatTimeline { totalMs: number; events: BeatEvent[] }

function toZone(target: 'head' | 'body' | 'legs' | null): 'head' | 'body' {
  return target === 'head' ? 'head' : 'body';
}

function strikePose(moveId: string | null): PoseName {
  if (moveId === 'jab' || moveId === 'cross' || moveId === 'hook') return moveId;
  return 'cross';
}

function targetBecameRocked(beat: ResolvedBeat): boolean {
  return beat.targetId === 'opponent'
    ? beat.status.opponentBecameRocked
    : beat.status.playerBecameRocked;
}

export function buildBeatTimeline(beat: ResolvedBeat, presentationSeed: string): BeatTimeline {
  const rng = createRng(presentationSeed + '#' + beat.id);
  const events: BeatEvent[] = [];
  let t = 0;

  function push(
    kind: BeatEventKind,
    dur: number,
    actor: BeatActor,
    opts?: { pose?: PoseName; intensity?: number; zone?: 'head' | 'body' },
  ): void {
    events.push({ tMs: t, durMs: dur, kind, actor, ...opts });
    t += dur;
  }

  if (beat.moveClass === 'signature') {
    // Opponent telegraphs the cross (windup) → actor slips → actor fires signature → impact
    push('windup', 80, beat.targetId, { pose: 'cross' });
    push('slip', 120, beat.actorId, { pose: 'slip' });
    push('strike', 100, beat.actorId, { pose: 'sig-load' });
    push('impact', 60, beat.targetId, { zone: 'head', intensity: 1 });
    push('flash', 40, beat.targetId, { zone: 'head', intensity: 1 });
    push('hitstop', 120, beat.actorId);
    push('shake', 60, beat.actorId, { intensity: 0.9 });
    if (beat.isFinish) {
      push('knockdown', 300, beat.targetId, { pose: 'down' });
    }
    push('recover', 200, beat.actorId);

  } else if (beat.outcome === 'evaded') {
    push('windup', 70, beat.actorId, { pose: strikePose(beat.moveId) });
    push('slip', 100, beat.targetId, { pose: 'slip' });
    push('recover', 100, beat.actorId);

  } else if (beat.outcome === 'blocked') {
    push('windup', 70, beat.actorId, { pose: strikePose(beat.moveId) });
    push('strike', 60, beat.actorId);
    push('block', 80, beat.targetId, { pose: 'guard' });
    push('shake', 40, beat.actorId, { intensity: 0.3 });
    push('recover', 100, beat.actorId);

  } else {
    // strike + landed (or countered non-signature)
    const windupDur = 60 + rng() * 20;
    const zone = toZone(beat.target);
    const headDelta = beat.targetId === 'opponent'
      ? beat.deltas.opponentHead
      : beat.deltas.playerHead;
    const intensity = Math.min(1, headDelta / 30);
    const reactionPose: PoseName = targetBecameRocked(beat)
      ? 'reel'
      : (zone === 'head' ? 'hit-head' : 'hit-body');

    push('windup', windupDur, beat.actorId, { pose: strikePose(beat.moveId) });
    push('strike', 80, beat.actorId);
    push('impact', 60, beat.targetId, { zone, intensity });
    push('flash', 40, beat.targetId, { zone, intensity });
    push('shake', 50, beat.actorId, { intensity: intensity * 0.7 });
    push('reaction', 100, beat.targetId, { pose: reactionPose });

    if (beat.isFinish) {
      push('knockdown', 300, beat.targetId, { pose: 'down' });
      push('hitstop', 150, beat.actorId);
    }

    push('recover', 120, beat.actorId);
  }

  return { totalMs: t, events };
}
