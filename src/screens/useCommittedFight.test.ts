import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, it, expect } from 'vitest';
import { useCommittedFight } from './useCommittedFight';
import type { FightState } from '../domain/combat';
import type { ResolvedBeat } from '../domain/combat/beat';

const fs = (headDamage: number): FightState => ({ player: { headDamage } }) as unknown as FightState;
const makeBeat = (id: string): ResolvedBeat => ({ id }) as unknown as ResolvedBeat;
const beat1 = makeBeat('b1');
const beat2 = makeBeat('b2');

describe('useCommittedFight', () => {
  it('commits immediately when release=true and same beat', () => {
    const { result, rerender } = renderHook(({ s, b, r }) => useCommittedFight(s, b, r), {
      initialProps: { s: fs(0), b: beat1, r: true },
    });
    expect(result.current.shown.player.headDamage).toBe(0);
    expect(result.current.committed).toBe(true);
    act(() => rerender({ s: fs(30), b: beat1, r: true }));
    expect(result.current.shown.player.headDamage).toBe(30);
    expect(result.current.committed).toBe(true);
  });

  it('holds the previous snapshot when new beat arrives (release=false, isPlaying)', () => {
    const { result, rerender } = renderHook(({ s, b, r }) => useCommittedFight(s, b, r), {
      initialProps: { s: fs(0), b: beat1, r: true },
    });
    act(() => rerender({ s: fs(30), b: beat2, r: false }));
    expect(result.current.shown.player.headDamage).toBe(0); // held
    expect(result.current.committed).toBe(false);
  });

  it('commits at impact (release=true after new beat)', () => {
    const { result, rerender } = renderHook(({ s, b, r }) => useCommittedFight(s, b, r), {
      initialProps: { s: fs(0), b: beat1, r: true },
    });
    act(() => rerender({ s: fs(30), b: beat2, r: false })); // new beat, hold
    act(() => rerender({ s: fs(30), b: beat2, r: true }));  // impact/release
    expect(result.current.shown.player.headDamage).toBe(30);
    expect(result.current.committed).toBe(true);
  });

  it('StrictMode: does not commit post-beat state on double-render (isPlaying=false, beat just arrived)', () => {
    const { result, rerender } = renderHook(
      ({ s, b, r }) => useCommittedFight(s, b, r),
      { wrapper: StrictMode, initialProps: { s: fs(0), b: beat1, r: true } },
    );
    act(() => rerender({ s: fs(40), b: beat2, r: false }));
    expect(result.current.shown.player.headDamage).toBe(0);
  });

  it('reduced-motion instant-commit: commits immediately when release=true with no beat change', () => {
    const { result, rerender } = renderHook(({ s, b, r }) => useCommittedFight(s, b, r), {
      initialProps: { s: fs(0), b: null, r: true },
    });
    act(() => rerender({ s: fs(50), b: null, r: true }));
    expect(result.current.shown.player.headDamage).toBe(50);
  });
});
