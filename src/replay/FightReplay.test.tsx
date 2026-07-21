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

    // Frame 2 – advance to ts=380: flash event spans tMs=360..400 on opponent/head
    await act(async () => {
      const cbs = [...rafCallbacks.values()];
      rafCallbacks.clear();
      cbs.forEach(cb => cb(380));
    });

    // FighterRig renders data-testid="flash-head" when flashHead=true
    expect(screen.getByTestId('flash-head')).toBeTruthy();
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
