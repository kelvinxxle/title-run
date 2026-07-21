import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import FighterRig from '../components/FighterRig';
import { buildBeatTimeline, computeFinalPose } from './timeline';
import type { BeatEvent } from './timeline';
import type { ResolvedBeat, BeatActor } from '../domain/combat/beat';
import type { PoseName } from './poses';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface FightReplayProps {
  beat: ResolvedBeat | null;
  playerId?: string;
  playerName: string;
  playerArchetype: string;
  opponentId?: string;
  opponentName: string;
  opponentArchetype: string;
  presentationSeed: string;
}

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

interface AnimState {
  playerPose: PoseName;
  opponentPose: PoseName;
  flashHeadPlayer: boolean;
  flashBodyPlayer: boolean;
  flashHeadOpponent: boolean;
  flashBodyOpponent: boolean;
  shakeX: number;
  isPlaying: boolean;
  finalPosePlayer: PoseName;
  finalPoseOpponent: PoseName;
}

const IDLE_STATE: AnimState = {
  playerPose: 'idle',
  opponentPose: 'idle',
  flashHeadPlayer: false,
  flashBodyPlayer: false,
  flashHeadOpponent: false,
  flashBodyOpponent: false,
  shakeX: 0,
  isPlaying: false,
  finalPosePlayer: 'idle',
  finalPoseOpponent: 'idle',
};

// ---------------------------------------------------------------------------
// Pure helpers (no side-effects, no Date.now, no Math.random)
// ---------------------------------------------------------------------------

function currentPose(events: BeatEvent[], actor: BeatActor, elapsed: number): PoseName {
  let pose: PoseName = 'idle';
  for (const e of events) {
    if (e.tMs > elapsed) break;
    if (e.actor === actor && e.pose != null) pose = e.pose;
  }
  return pose;
}

function flashActive(events: BeatEvent[], actor: BeatActor, zone: 'head' | 'body', elapsed: number): boolean {
  return events.some(
    e => e.kind === 'flash' && e.actor === actor && e.zone === zone &&
      elapsed >= e.tMs && elapsed < e.tMs + e.durMs,
  );
}

function shakeOffset(events: BeatEvent[], elapsed: number): number {
  const ev = events.find(
    e => e.kind === 'shake' && elapsed >= e.tMs && elapsed < e.tMs + e.durMs,
  );
  if (!ev) return 0;
  const phase = (elapsed - ev.tMs) / ev.durMs;
  return Math.sin(phase * Math.PI * 4) * (ev.intensity ?? 0) * 8;
}

function snapshotState(
  events: BeatEvent[],
  totalMs: number,
  elapsed: number,
  finalPosePlayer: PoseName,
  finalPoseOpponent: PoseName,
  done: boolean,
): AnimState {
  const t = Math.min(elapsed, totalMs);
  return {
    playerPose: currentPose(events, 'player', t),
    opponentPose: currentPose(events, 'opponent', t),
    flashHeadPlayer: flashActive(events, 'player', 'head', t),
    flashBodyPlayer: flashActive(events, 'player', 'body', t),
    flashHeadOpponent: flashActive(events, 'opponent', 'head', t),
    flashBodyOpponent: flashActive(events, 'opponent', 'body', t),
    shakeX: done ? 0 : shakeOffset(events, t),
    isPlaying: !done,
    finalPosePlayer,
    finalPoseOpponent,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FightReplay({
  beat,
  playerId,
  playerName,
  playerArchetype,
  opponentId,
  opponentName,
  opponentArchetype,
  presentationSeed,
}: FightReplayProps): JSX.Element {
  const [animState, setAnimState] = useState<AnimState>(IDLE_STATE);

  const rafIdRef = useRef<number | null>(null);
  const gameElapsedRef = useRef<number>(0);
  const hitstopWallTimeRef = useRef<number>(0);
  const prevRafTsRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any running frame loop
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (beat == null) {
      setAnimState(IDLE_STATE);
      return;
    }

    const timeline = buildBeatTimeline(beat, presentationSeed);
    const { events, totalMs } = timeline;

    const finalPosePlayer = computeFinalPose(events, 'player');
    const finalPoseOpponent = computeFinalPose(events, 'opponent');

    // Honour prefers-reduced-motion: skip rAF, snap to final state
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimState({
        playerPose: finalPosePlayer,
        opponentPose: finalPoseOpponent,
        flashHeadPlayer: false,
        flashBodyPlayer: false,
        flashHeadOpponent: false,
        flashBodyOpponent: false,
        shakeX: 0,
        isPlaying: false,
        finalPosePlayer,
        finalPoseOpponent,
      });
      return;
    }

    // Normal animation path via requestAnimationFrame
    gameElapsedRef.current = 0;
    hitstopWallTimeRef.current = 0;
    prevRafTsRef.current = null;

    // Show initial state (t=0) + mark playing
    setAnimState(snapshotState(events, totalMs, 0, finalPosePlayer, finalPoseOpponent, false));

    function frame(rafTs: number): void {
      // First frame: initialise prev timestamp (delta = 0 on this tick)
      if (prevRafTsRef.current === null) {
        prevRafTsRef.current = rafTs;
      }

      const delta = rafTs - prevRafTsRef.current;
      prevRafTsRef.current = rafTs;

      // Hitstop: accumulate real wall-clock time while the event is active.
      // Once wall-clock debt >= durMs, jump game clock past the hitstop window.
      const hsEvent = events.find(
        e => e.kind === 'hitstop' &&
          gameElapsedRef.current >= e.tMs &&
          gameElapsedRef.current < e.tMs + e.durMs,
      );

      if (hsEvent) {
        hitstopWallTimeRef.current += delta;
        if (hitstopWallTimeRef.current >= hsEvent.durMs) {
          gameElapsedRef.current = hsEvent.tMs + hsEvent.durMs;
          hitstopWallTimeRef.current = 0;
        }
        // Else: stay frozen (don't advance game clock this frame)
      } else {
        gameElapsedRef.current += delta;
      }

      const done = gameElapsedRef.current >= totalMs;
      setAnimState(snapshotState(events, totalMs, gameElapsedRef.current, finalPosePlayer, finalPoseOpponent, done));

      if (!done) {
        rafIdRef.current = requestAnimationFrame(frame);
      } else {
        rafIdRef.current = null;
      }
    }

    rafIdRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [beat, presentationSeed]);

  const containerStyle: React.CSSProperties | undefined =
    animState.shakeX !== 0
      ? { transform: `translate(${animState.shakeX}px, 0)` }
      : undefined;

  return (
    <div
      data-testid="fight-replay"
      data-playing={animState.isPlaying ? 'true' : 'false'}
      data-final-pose-player={animState.finalPosePlayer}
      data-final-pose-opponent={animState.finalPoseOpponent}
      style={containerStyle}
    >
      <div data-testid="replay-player">
        <FighterRig
          seed={playerId ?? playerName}
          archetype={playerArchetype}
          name={playerName}
          pose={animState.playerPose}
          facing="right"
          flashHead={animState.flashHeadPlayer}
          flashBody={animState.flashBodyPlayer}
          downed={animState.playerPose === 'down'}
        />
      </div>
      <div data-testid="replay-opponent">
        <FighterRig
          seed={opponentId ?? opponentName}
          archetype={opponentArchetype}
          name={opponentName}
          pose={animState.opponentPose}
          facing="left"
          flashHead={animState.flashHeadOpponent}
          flashBody={animState.flashBodyOpponent}
          downed={animState.opponentPose === 'down'}
        />
      </div>
    </div>
  );
}
