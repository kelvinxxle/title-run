import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCommittedFight } from './useCommittedFight';
import type { FightState } from '../domain/combat';

const fs = (headDamage: number) => ({ player: { headDamage } }) as unknown as FightState;

describe('useCommittedFight', () => {
  it('commits immediately when committed=true', () => {
    const { result, rerender } = renderHook(({ s, c }) => useCommittedFight(s, c), {
      initialProps: { s: fs(0), c: true },
    });
    expect(result.current.player.headDamage).toBe(0);
    rerender({ s: fs(30), c: true });
    expect(result.current.player.headDamage).toBe(30);
  });
  it('holds the previous snapshot while committed=false', () => {
    const { result, rerender } = renderHook(({ s, c }) => useCommittedFight(s, c), {
      initialProps: { s: fs(0), c: true },
    });
    rerender({ s: fs(30), c: false }); // new state, not yet committed
    expect(result.current.player.headDamage).toBe(0); // held
    rerender({ s: fs(30), c: true }); // impact/completion
    expect(result.current.player.headDamage).toBe(30);
  });
});
