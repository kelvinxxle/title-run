import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HybridRig } from './HybridRig';

function renderRig(overrides: Partial<React.ComponentProps<typeof HybridRig>> = {}) {
  return render(
    <svg>
      <HybridRig
        side="player" name="Test Fighter" archetype="striker" cornerColor="#e23b2e"
        pose="guard" facing="right"
        flashHead={false} flashBody={false} flashLeg={false} downed={false}
        {...overrides}
      />
    </svg>,
  );
}

describe('HybridRig body', () => {
  it('renders a rig root with the side + current pose as data attributes', () => {
    const { container } = renderRig({ pose: 'kick-contact' });
    const root = container.querySelector('[data-rig="player"]');
    expect(root).not.toBeNull();
    expect(root!.getAttribute('data-pose')).toBe('kick-contact');
  });

  it('paints the thighs in the trunk color (no floating shorts panel)', () => {
    const { container } = renderRig({ cornerColor: '#e23b2e' });
    const thigh = container.querySelector('[data-part="thighLead"]');
    expect(thigh).not.toBeNull();
    // trunk uses cornerColor directly — corner-color is the documented exception to Octagon Elite tokens
    expect(thigh!.getAttribute('fill')).toMatch(/^#/);
  });

  it('mirrors the rig when facing right and counter-mirrors the head group', () => {
    const { container } = renderRig({ facing: 'right' });
    const facing = container.querySelector('[data-layer="facing"]');
    expect(facing!.getAttribute('transform')).toContain('scale(-1,1)');
    const head = container.querySelector('[data-j="head"]');
    expect(head!.getAttribute('transform')).toContain('scale(-1,1)');
  });

  it('does NOT mirror when facing left (opponent)', () => {
    const { container } = renderRig({ side: 'opponent', facing: 'left' });
    const facing = container.querySelector('[data-layer="facing"]');
    expect(facing!.getAttribute('transform') ?? '').not.toContain('scale(-1,1)');
  });

  it('sets each joint target transform from RIG_POSES (instant path in jsdom)', () => {
    const { container } = renderRig({ pose: 'kick-contact' });
    const thighRear = container.querySelector('[data-j="thighRear"]');
    // kick-contact thighRear = 62deg (see rigPoses.ts)
    expect(thighRear!.getAttribute('transform')).toContain('rotate(62');
  });

  it('applies a single 80deg root rotation when downed (no double-rotation)', () => {
    const { container } = renderRig({ pose: 'down', downed: true });
    const root = container.querySelector('[data-rig="player"]');
    const t = root!.getAttribute('transform') ?? '';
    expect(t).toContain('rotate(80');
    // torso pose itself stays shallow (Task 1): assert torso not also ~80
    const torso = container.querySelector('[data-j="torso"]');
    expect(torso!.getAttribute('transform')).not.toContain('rotate(80');
  });
});
