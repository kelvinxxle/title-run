import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ArenaStage } from './ArenaStage';
import { IDLE_PLAYBACK } from '../replay/useBeatPlayback';

const ids = {
  player: { fighterId: undefined, name: 'You', archetype: 'striker' as const, cornerColor: '#e23b2e' },
  opponent: { fighterId: 'jon-jones', name: 'Jon Jones', archetype: 'allrounder' as const, cornerColor: '#2f6fb0' },
};

describe('ArenaStage', () => {
  it('mounts both rigs with correct facing (player right, opponent left)', () => {
    const { container } = render(
      <ArenaStage mode="standing-idle" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />,
    );
    expect(container.querySelector('[data-rig="player"]')).not.toBeNull();
    expect(container.querySelector('[data-rig="opponent"]')).not.toBeNull();
  });

  it('applies shakeX to the shake layer, not the HUD', () => {
    const play = { ...IDLE_PLAYBACK, shakeX: 6 };
    const { container } = render(
      <ArenaStage mode="active-playback" play={play} {...ids} hud={<div data-testid="hud" />} roundLabel="ROUND 1" />,
    );
    const shake = container.querySelector('[data-layer="shake"]');
    expect(shake!.getAttribute('transform')).toContain('translate(6');
  });

  it('adds the arena-idle class only in standing-idle mode', () => {
    const { container: idle } = render(
      <ArenaStage mode="standing-idle" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />);
    expect(idle.querySelector('.arena-idle')).not.toBeNull();
    const { container: playing } = render(
      <ArenaStage mode="active-playback" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />);
    expect(playing.querySelector('.arena-idle')).toBeNull();
  });

  it('keeps the losing fighter down in ko-down mode', () => {
    const play = { ...IDLE_PLAYBACK, opponentPose: 'down' as const };
    const { container } = render(
      <ArenaStage mode="ko-down" play={play} {...ids} hud={null} roundLabel="ROUND 3" />);
    expect(container.querySelector('[data-rig="opponent"]')!.getAttribute('data-pose')).toBe('down');
  });

  it('only exposes the idle bob group under the arena-idle wrapper', () => {
    const { container } = render(
      <ArenaStage mode="standing-idle" play={IDLE_PLAYBACK} {...ids} hud={null} roundLabel="ROUND 1" />);
    expect(container.querySelector('.arena-idle .rig-bob')).not.toBeNull();
  });
});
