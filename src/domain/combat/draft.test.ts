import { describe, it, expect } from 'vitest';
import { startDraft, keepStat, availableStatIds, nameFighter, getDraftedFighter } from './draft';

describe('v2 draft', () => {
  it('fills all 9 slots by keeping one stat per roll, then names', () => {
    let d = startDraft('seed-1');
    while (d.status === 'drafting') d = keepStat(d, availableStatIds(d)[0]);
    expect(d.status).toBe('naming');
    d = nameFighter(d, 'Kid Dynamite');
    const drafted = getDraftedFighter(d);
    expect(Object.keys(drafted.statLine)).toHaveLength(9);
    expect(drafted.name).toBe('Kid Dynamite');
  });
  it('is deterministic per seed', () => {
    const first = startDraft('same').current;
    const again = startDraft('same').current;
    expect(first).toEqual(again);
  });
});
