import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import FightReplay from './FightReplay';
import type { ResolvedBeat } from '../domain/combat/beat';

const sigKoBeat: ResolvedBeat = {
  id: '2-3', round: 2, exchange: 3,
  actorId: 'player', targetId: 'opponent',
  moveClass: 'signature', moveId: null, outcome: 'countered', target: 'head',
  deltas: { playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0,
    opponentHead: 60, opponentBody: 0, opponentLeg: 0, opponentStamina: -10 },
  status: { playerBecameRocked: false, opponentBecameRocked: true, playerGassed: false, opponentGassed: false },
  signatureId: 'the-left-hand', isFinish: true, finishMethod: 'KO',
};

const props = {
  playerId: 'p1', playerName: 'P', playerArchetype: 'striker',
  opponentId: 'o1', opponentName: 'O', opponentArchetype: 'brawler',
  presentationSeed: 'char-seed',
};

function setup() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: (q: string) => ({ matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
  });
  const cbs = new Map<number, FrameRequestCallback>();
  let id = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const i = id++; cbs.set(i, cb); return i; });
  vi.stubGlobal('cancelAnimationFrame', (i: number) => { cbs.delete(i); });
  return cbs;
}

function pump(cbs: Map<number, FrameRequestCallback>, ts: number) {
  const list = [...cbs.values()];
  cbs.clear();
  list.forEach(cb => cb(ts));
}

function snap() {
  const el = screen.getByTestId('fight-replay');
  return {
    playing: el.getAttribute('data-playing'),
    finalP: el.getAttribute('data-final-pose-player'),
    finalO: el.getAttribute('data-final-pose-opponent'),
    playerPose: screen.getAllByTestId('fighter-rig')[0].getAttribute('data-pose'),
    opponentPose: screen.getAllByTestId('fighter-rig')[1].getAttribute('data-pose'),
  };
}

describe('playback characterization (pre-extraction baseline)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('produces a stable frame trace for a fixed beat+seed', async () => {
    const cbs = setup();
    render(<FightReplay {...props} beat={sigKoBeat} />);
    const trace: unknown[] = [];
    await act(async () => { pump(cbs, 0); });      trace.push(snap());
    await act(async () => { pump(cbs, 200); });    trace.push(snap());
    await act(async () => { pump(cbs, 480); });    trace.push(snap());
    await act(async () => { pump(cbs, 900); });    trace.push(snap());
    await act(async () => { pump(cbs, 2000); });   trace.push(snap());

    // Snapshot the whole trace. This locks CURRENT behavior; Task 3 must not change it.
    expect(trace).toMatchInlineSnapshot(`
      [
        {
          "finalO": "down",
          "finalP": "idle",
          "opponentPose": "cross",
          "playerPose": "idle",
          "playing": "true",
        },
        {
          "finalO": "down",
          "finalP": "idle",
          "opponentPose": "cross",
          "playerPose": "sig-load",
          "playing": "true",
        },
        {
          "finalO": "down",
          "finalP": "idle",
          "opponentPose": "cross",
          "playerPose": "sig-fire",
          "playing": "true",
        },
        {
          "finalO": "down",
          "finalP": "idle",
          "opponentPose": "down",
          "playerPose": "sig-fire",
          "playing": "true",
        },
        {
          "finalO": "down",
          "finalP": "idle",
          "opponentPose": "down",
          "playerPose": "idle",
          "playing": "false",
        },
      ]
    `);
  });
});
