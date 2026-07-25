import { useEffect, useRef, useState } from 'react';
import { buildBeatTimeline, computeFinalPose } from './timeline';
import type { BeatEvent } from './timeline';
import type { ResolvedBeat, BeatActor } from '../domain/combat/beat';
import type { PoseName } from './poses';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PlaybackState {
  playerPose: PoseName;
  opponentPose: PoseName;
  flashHeadPlayer: boolean;
  flashBodyPlayer: boolean;
  flashHeadOpponent: boolean;
  flashBodyOpponent: boolean;
  flashLegPlayer: boolean;
  flashLegOpponent: boolean;
  shakeX: number;
  isPlaying: boolean;
  finalPosePlayer: PoseName;
  finalPoseOpponent: PoseName;
}

const IDLE_STATE: PlaybackState = {
  playerPose: 'idle',
  opponentPose: 'idle',
  flashHeadPlayer: false,
  flashBodyPlayer: false,
  flashHeadOpponent: false,
  flashBodyOpponent: false,
  flashLegPlayer: false,
  flashLegOpponent: false,
  shakeX: 0,
  isPlaying: false,
  finalPosePlayer: 'idle',
  finalPoseOpponent: 'idle',
};

export const IDLE_PLAYBACK: PlaybackState = IDLE_STATE;

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

function flashActive(events: BeatEvent[], actor: BeatActor, zone: 'head' | 'body' | 'legs', elapsed: number): boolean {
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
): PlaybackState {
  const t = Math.min(elapsed, totalMs);
  return {
    playerPose: currentPose(events, 'player', t),
    opponentPose: currentPose(events, 'opponent', t),
    flashHeadPlayer: flashActive(events, 'player', 'head', t),
    flashBodyPlayer: flashActive(events, 'player', 'body', t),
    flashHeadOpponent: flashActive(events, 'opponent', 'head', t),
    flashBodyOpponent: flashActive(events, 'opponent', 'body', t),
    flashLegPlayer: flashActive(events, 'player', 'legs', t),
    flashLegOpponent: flashActive(events, 'opponent', 'legs', t),
    shakeX: done ? 0 : shakeOffset(events, t),
    isPlaying: !done,
    finalPosePlayer,
    finalPoseOpponent,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBeatPlayback(beat: ResolvedBeat | null, presentationSeed: string): PlaybackState {
  const [state, setState] = useState<PlaybackState>(IDLE_STATE);

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
      setState(IDLE_STATE);
      return;
    }

    const timeline = buildBeatTimeline(beat, presentationSeed);
    const { events, totalMs } = timeline;

    const finalPosePlayer = computeFinalPose(events, 'player');
    const finalPoseOpponent = computeFinalPose(events, 'opponent');

    // Honour prefers-reduced-motion: skip rAF, snap to final state
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState({
        playerPose: finalPosePlayer,
        opponentPose: finalPoseOpponent,
        flashHeadPlayer: false,
        flashBodyPlayer: false,
        flashHeadOpponent: false,
        flashBodyOpponent: false,
        flashLegPlayer: false,
        flashLegOpponent: false,
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
    setState(snapshotState(events, totalMs, 0, finalPosePlayer, finalPoseOpponent, false));

    function frame(rafTs: number): void {
      // First frame: initialise prev timestamp (delta = 0 on this tick)
      if (prevRafTsRef.current === null) {
        prevRafTsRef.current = rafTs;
      }

      const delta = rafTs - prevRafTsRef.current;
      prevRafTsRef.current = rafTs;

      // Advance game clock respecting hitstop events.
      // Process delta in segments: advance normally until hitting a hitstop,
      // freeze real time during hitstop, resume with leftover after hitstop.
      let remaining = delta;
      const MAX_SEGMENTS = 8; // safety guard against float precision loops
      for (let seg = 0; seg < MAX_SEGMENTS && remaining > 0.5; seg++) {
        const hsEvent = events.find(
          e => e.kind === 'hitstop' &&
            gameElapsedRef.current >= e.tMs &&
            gameElapsedRef.current < e.tMs + e.durMs,
        );

        if (hsEvent) {
          // Inside a hitstop: consume wall-clock budget
          const need = hsEvent.durMs - hitstopWallTimeRef.current;
          if (remaining < need) {
            // Not enough to exit the hitstop this frame — stay frozen
            hitstopWallTimeRef.current += remaining;
            remaining = 0;
          } else {
            // Hitstop expires this frame — resume after it
            hitstopWallTimeRef.current = 0;
            gameElapsedRef.current = hsEvent.tMs + hsEvent.durMs;
            remaining -= need;
          }
        } else {
          // Normal advance — but stop at the next hitstop start
          const nextHs = events
            .filter(e => e.kind === 'hitstop' && e.tMs > gameElapsedRef.current)
            .sort((a, b) => a.tMs - b.tMs)[0];
          if (nextHs) {
            const toHs = nextHs.tMs - gameElapsedRef.current;
            if (remaining <= toHs) {
              gameElapsedRef.current += remaining;
              remaining = 0;
            } else {
              // Advance up to the hitstop entry; let next iteration enter it
              gameElapsedRef.current = nextHs.tMs;
              remaining -= toHs;
            }
          } else {
            gameElapsedRef.current += remaining;
            remaining = 0;
          }
        }
      }

      const done = gameElapsedRef.current >= totalMs;
      setState(snapshotState(events, totalMs, gameElapsedRef.current, finalPosePlayer, finalPoseOpponent, done));

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

  return state;
}
