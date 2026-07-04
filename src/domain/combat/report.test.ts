import { describe, it, expect } from 'vitest';
import { buildRoundReport, type RoundReportInput } from './report';

const base: RoundReportInput = {
  round: 1,
  winner: 'player',
  dominance: 20,
  playerIntent: { kind: 'strike', target: 'head', tactic: 'pickApart' },
  opponentIntent: { kind: 'strike', target: 'head', tactic: 'pressure' },
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

  it('calls out a perfect player counter over opponent pressure', () => {
    const report = buildRoundReport({
      ...base,
      winner: 'player',
      dominance: 7,
      playerIntent: { kind: 'strike', target: 'head', tactic: 'counter' },
      opponentIntent: { kind: 'strike', target: 'body', tactic: 'pressure' },
      opponentGassed: true,
    });

    expect(report.headline).toBe('Perfect counter — you read him cold.');
    expect(report.detail).toBe("He's sucking wind.");
  });

  it('calls out when the opponent counters player pressure', () => {
    const report = buildRoundReport({
      ...base,
      winner: 'opponent',
      dominance: -7,
      playerIntent: { kind: 'strike', target: 'body', tactic: 'pressure' },
      opponentIntent: { kind: 'strike', target: 'head', tactic: 'counter' },
    });

    expect(report.headline).toBe('He read you cold.');
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
