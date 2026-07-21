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

    // APPROACH: large-delta leftover test — directly guards the I4 leftover-application fix.
    //
    // Signature timeline: hitstop tMs=440, durMs=120, totalMs=1160.
    //
    // Phase 1 pumps 28 × 16ms small frames (wall ts=448ms).
    //   I4 straddle stop: game enters hitstop at exactly 440ms; hitstopWallTime=8ms.
    //   Thus: need remaining to exit = 120-8 = 112ms.
    //
    // Phase 2 pumps ONE 800ms frame.
    //   WITH I4 (leftover applied):
    //     hitstop needs 112ms more; 800>=112 → expires.
    //     game = 440+120 = 560ms. remaining = 800-112 = 688ms.
    //     game += 688 = 1248ms ≥ 1160ms → DONE → 'false'  ✓ passes
    //   WITHOUT leftover (bug: remaining set to 0 after hitstop expiry):
    //     hitstop expires same; game=560ms. remaining = 0 (discarded).
    //     game=560ms < 1160ms → still playing → 'true'  ✗ fails → RED
    //
    // The assertion at Phase 2 is the regression guard for I4's leftover-application fix.

    let ts = 0;

    // Phase 1: pump 28 × 16ms frames (ts=448ms).
    for (let i = 0; i < 28; i++) {
      ts += 16;
      await act(async () => {
        const cbs = [...rafCallbacks.values()];
        rafCallbacks.clear();
        cbs.forEach(cb => cb(ts));
      });
    }
    // ts=448ms. game≈440ms (in hitstop, hitstopWallTime=8ms). Animation still playing.
    expect(screen.getByTestId('fight-replay').getAttribute('data-playing')).toBe('true');

    // Phase 2: ONE large 800ms frame (ts=1248ms) — DISCRIMINATING CHECKPOINT.
    // I4: applies 688ms leftover → game=1248ms ≥ totalMs → DONE.
    // Without leftover fix: game stays at 560ms → NOT done → 'true'.
    ts += 800; // ts === 1248ms
    await act(async () => {
      const cbs = [...rafCallbacks.values()];
      rafCallbacks.clear();
      cbs.forEach(cb => cb(ts));
    });
    expect(screen.getByTestId('fight-replay').getAttribute('data-playing')).toBe('false');

    // Phase 3: pump 20 more frames to confirm still done.
    for (let i = 0; i < 20; i++) {
      ts += 16;
      await act(async () => {
        const cbs = [...rafCallbacks.values()];
        rafCallbacks.clear();
        cbs.forEach(cb => cb(ts));
      });
    }
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
