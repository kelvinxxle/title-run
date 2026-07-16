import { describe, it, expect } from 'vitest';
import { buildRoundReport, type RoundReportInput } from './report';

const base: RoundReportInput = {
  round: 1,
  winner: 'player',
  dominance: 20,
  playerIntent: { kind: 'strike', strike: 'powerPunch' },
  opponentIntent: { kind: 'strike', strike: 'powerPunch' },
  playerHeadDelta: 0,
  playerBodyDelta: 0,
  opponentHeadDelta: 10,
  opponentBodyDelta: 0,
  playerBecameRocked: false,
  opponentBecameRocked: false,
  playerGassed: false,
  opponentGassed: false,
};

describe('buildRoundReport', () => {
  it('uses the hurt headline when the opponent became rocked', () => {
    const report = buildRoundReport({
      ...base,
      opponentBecameRocked: true,
      opponentBodyDelta: 8,
    });

    expect(report.headline).toBe("You've got him HURT!");
    expect(report.detail).toBe('Body work is adding up — his gas will pay for it.');
  });

  it('uses the rocked headline when the player became rocked', () => {
    const report = buildRoundReport({
      ...base,
      playerBecameRocked: true,
      playerGassed: true,
    });

    expect(report.headline).toBe("You're ROCKED — hang on!");
    expect(report.detail).toBe("You're sucking wind.");
  });

  it('calls out a perfect player timing read over an opponent commit', () => {
    const report = buildRoundReport({
      ...base,
      winner: 'player',
      dominance: 7,
      playerIntent: { kind: 'strike', strike: 'jab' },
      opponentIntent: { kind: 'strike', strike: 'powerPunch' },
      opponentGassed: true,
    });

    expect(report.headline).toBe('Perfect timing — you read him cold.');
    expect(report.detail).toBe("He's sucking wind.");
  });

  it('calls out when the opponent times the player commit', () => {
    const report = buildRoundReport({
      ...base,
      winner: 'opponent',
      dominance: -7,
      playerIntent: { kind: 'strike', strike: 'powerPunch' },
      opponentIntent: { kind: 'strike', strike: 'jab' },
    });

    expect(report.headline).toBe('He timed you cold.');
    expect(report.detail).toBe('You picked him apart at range.');
  });

  it('uses the high-dominance player win headline', () => {
    const report = buildRoundReport({
      ...base,
      winner: 'player',
      dominance: 15,
    });

    expect(report.headline).toBe('You lit him up.');
    expect(report.detail).toBe('You picked him apart at range.');
  });

  it('uses the moderate-dominance player win headline', () => {
    const report = buildRoundReport({
      ...base,
      winner: 'player',
      dominance: 6,
    });

    expect(report.headline).toBe('You took the round.');
  });

  it('uses the draw headline for even rounds', () => {
    const report = buildRoundReport({
      ...base,
      winner: 'draw',
      dominance: 0,
    });

    expect(report.headline).toBe('Even round — nobody blinked.');
  });

  it('calls out leg chopping in the detail when the winner kicked the legs', () => {
    const r = buildRoundReport({
      round: 1, winner: 'player', dominance: 9,
      playerIntent: { kind: 'strike', strike: 'legKick' },
      opponentIntent: { kind: 'strike', strike: 'jab' },
      playerHeadDelta: 0, playerBodyDelta: 0, opponentHeadDelta: 0, opponentBodyDelta: 0,
      playerBecameRocked: false, opponentBecameRocked: false, playerGassed: false, opponentGassed: false,
    });
    expect(r.detail.toLowerCase()).toContain('base');
  });

  it('returns the same report for the same input every time', () => {
    const input: RoundReportInput = {
      ...base,
      round: 2,
      dominance: 11,
      opponentBodyDelta: 3,
      opponentGassed: true,
    };

    expect(buildRoundReport(input)).toEqual(buildRoundReport(input));
  });
});

import { buildGroundReport } from './report';

describe('buildGroundReport', () => {
  it('narrates a submission tap as the headline', () => {
    const r = buildGroundReport({ round: 2, action: 'submission', position: 'back', success: true, opponentHeadDelta: 0, escaped: false, submitted: true });
    expect(r.headline.toLowerCase()).toContain('rear-naked choke');
    expect(r.winner).toBe('player');
  });
  it('narrates an advance and an escape distinctly', () => {
    const adv = buildGroundReport({ round: 1, action: 'advance', position: 'mount', success: true, opponentHeadDelta: 0, escaped: false, submitted: false });
    expect(adv.headline.toLowerCase()).toContain('mount');
    const esc = buildGroundReport({ round: 1, action: 'ground-and-pound', position: 'side-control', success: true, opponentHeadDelta: 12, escaped: true, submitted: false });
    expect(esc.detail.toLowerCase()).toContain('escap');
    expect(esc.opponentHeadDelta).toBe(12);
  });
});
