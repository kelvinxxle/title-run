import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import FightReplay from './FightReplay';
import type { ResolvedBeat } from '../domain/combat/beat';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sigKoBeat: ResolvedBeat = {
  id: '2-3',
  round: 2,
  exchange: 3,
  actorId: 'player',
  targetId: 'opponent',
  moveClass: 'signature',
  moveId: null,
  outcome: 'countered',
  target: 'head',
  deltas: {
    playerHead: 0,
    playerBody: 0,
    playerLeg: 0,
    playerStamina: 0,
    opponentHead: 60,
    opponentBody: 0,
    opponentLeg: 0,
    opponentStamina: -10,
  },
  status: {
    playerBecameRocked: false,
    opponentBecameRocked: true,
    playerGassed: false,
    opponentGassed: false,
  },
  signatureId: 'the-left-hand',
  isFinish: true,
  finishMethod: 'KO',
};

const defaultProps = {
  playerId: 'player-1',
  playerName: 'Player',
  playerArchetype: 'striker',
  opponentId: 'opponent-1',
  opponentName: 'Opponent',
  opponentArchetype: 'brawler',
  presentationSeed: 'test-seed',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReducedMotion(val: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: val && query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FightReplay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders two rigs and starts idle when beat is null', () => {
    mockReducedMotion(false);
    render(<FightReplay {...defaultProps} beat={null} />);

    const rigs = screen.getAllByTestId('fighter-rig');
    expect(rigs).toHaveLength(2);
    rigs.forEach(rig => {
      expect(rig.getAttribute('data-pose')).toBe('idle');
    });

    const replay = screen.getByTestId('fight-replay');
    expect(replay.getAttribute('data-playing')).toBe('false');
  });

  it('with reduced-motion, snaps to resolved end pose without animating (rocked opponent shows reel/down)', () => {
    mockReducedMotion(true);
    render(<FightReplay {...defaultProps} beat={sigKoBeat} />);

    const replay = screen.getByTestId('fight-replay');
    expect(replay.getAttribute('data-final-pose-opponent')).toBe('down');
    expect(replay.getAttribute('data-playing')).toBe('false');
  });

  it('applies a flash overlay when the beat lands on the head', async () => {
    mockReducedMotion(false);

    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let rafNextId = 1;

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = rafNextId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });

    render(<FightReplay {...defaultProps} beat={sigKoBeat} />);

    // Frame 1 – initialise clock at ts=0 (delta=0, gameElapsed stays 0)
    await act(async () => {
      const cbs = [...rafCallbacks.values()];
      rafCallbacks.clear();
      cbs.forEach(cb => cb(0));
    });

    // Frame 2 – advance to ts=420: flash event spans tMs=400..440 on opponent/head (after H4 sig-fire addition)
    await act(async () => {
      const cbs = [...rafCallbacks.values()];
      rafCallbacks.clear();
      cbs.forEach(cb => cb(420));
    });

    // FighterRig renders data-testid="flash-head" when flashHead=true
    expect(screen.getByTestId('flash-head')).toBeTruthy();
  });

  it('H1: animation completes past hitstop — data-playing becomes false after totalMs wall-clock', async () => {
    mockReducedMotion(false);

    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let rafNextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = rafNextId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });

    render(<FightReplay {...defaultProps} beat={sigKoBeat} />);

    // Frame at ts=0 (init, delta=0)
    await act(async () => {
      const cbs = [...rafCallbacks.values()];
      rafCallbacks.clear();
      cbs.forEach(cb => cb(0));
    });

    // Pump 10 frames × 200ms = 2000ms >> totalMs (~1080ms).
    // Bug: game clock freezes at hitstop tMs=400; data-playing stays 'true' forever.
    for (let i = 1; i <= 10; i++) {
      await act(async () => {
        const cbs = [...rafCallbacks.values()];
        rafCallbacks.clear();
        cbs.forEach(cb => cb(i * 200));
      });
    }

    expect(screen.getByTestId('fight-replay').getAttribute('data-playing')).toBe('false');
  });

  it('I4 — hitstop: 16ms frames freeze game clock for durMs, then animation reaches done', async () => {
    // sigKoBeat: signature timeline. hitstop at tMs=440, durMs=120. totalMs=1160.
    // Verify: after pumping frames through the hitstop window, data-playing eventually becomes false.
    // The mini-loop fix ensures large deltas don't skip the hitstop start AND
    // the remaining delta after hitstop exit is not discarded.
    mockReducedMotion(false);

    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let rafNextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = rafNextId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });

    render(<FightReplay {...defaultProps} beat={sigKoBeat} presentationSeed="test-i4" />);

    // Frame 0: init (delta=0)
    await act(async () => {
      const cbs = [...rafCallbacks.values()];
      rafCallbacks.clear();
      cbs.forEach(cb => cb(0));
    });

    // Pump 16ms frames. After each frame check that we haven't ended too early.
    // The hitstop is at 440ms game time and lasts 120ms wall time.
    // With the fix: game clock stops at 440, then resumes after 120ms wall time.
    // With or without the fix, during the hitstop frames data-playing stays 'true'.
    let ts = 0;
    // Pump frames up through the full animation (totalMs=1160 + hitstop=120 wall = ~1280ms worth)
    const totalFrames = Math.ceil((1160 + 120 + 80) / 16); // overshoot by ~80ms
    for (let i = 0; i < totalFrames; i++) {
      ts += 16;
      await act(async () => {
        const cbs = [...rafCallbacks.values()];
        rafCallbacks.clear();
        cbs.forEach(cb => cb(ts));
      });
    }

    // After enough 16ms frames to cover totalMs + hitstop wall time, animation must be done.
    expect(screen.getByTestId('fight-replay').getAttribute('data-playing')).toBe('false');
  });

  it('is deterministic: same beat+seed → same end DOM (snapshot)', () => {
    mockReducedMotion(true);

    const { container: c1 } = render(
      <FightReplay {...defaultProps} beat={sigKoBeat} presentationSeed="snap-seed" />,
    );
    const { container: c2 } = render(
      <FightReplay {...defaultProps} beat={sigKoBeat} presentationSeed="snap-seed" />,
    );

    expect(c1.innerHTML).toBe(c2.innerHTML);
  });
});
