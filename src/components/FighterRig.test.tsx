import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FighterRig from './FighterRig';

const baseProps = {
  seed: 'test-seed-123',
  archetype: 'striker',
  name: 'Test Fighter',
  pose: 'idle' as const,
  facing: 'right' as const,
};

describe('FighterRig', () => {
  it('renders with data-pose and data-facing attributes', () => {
    const { getByTestId } = render(<FighterRig {...baseProps} pose="guard" facing="right" />);
    const rig = getByTestId('fighter-rig');
    expect(rig).toHaveAttribute('data-pose', 'guard');
    expect(rig).toHaveAttribute('data-facing', 'right');
    expect(rig).toHaveAttribute('role', 'img');
    expect(rig).toHaveAttribute('aria-label', 'Test Fighter guard');
  });

  it('different pose produces different lead-arm transform', () => {
    const { getByTestId, rerender } = render(<FighterRig {...baseProps} pose="guard" />);
    const guardTransform = getByTestId('rig-lead-arm').getAttribute('transform');

    rerender(<FighterRig {...baseProps} pose="cross" />);
    const crossTransform = getByTestId('rig-lead-arm').getAttribute('transform');

    expect(guardTransform).not.toEqual(crossTransform);
  });

  it('determinism: same props produce identical markup', () => {
    const { container: c1 } = render(<FighterRig {...baseProps} />);
    const { container: c2 } = render(<FighterRig {...baseProps} />);
    expect(c1.innerHTML).toBe(c2.innerHTML);
  });

  it('facing=left adds scale(-1,1) group transform', () => {
    const { container } = render(<FighterRig {...baseProps} facing="left" />);
    const svg = container.querySelector('svg');
    const mirrorGroup = svg?.querySelector('g[transform*="scale(-1,1)"]');
    expect(mirrorGroup).toBeTruthy();
  });

  it('flashHead renders a head overlay element', () => {
    const { container } = render(<FighterRig {...baseProps} flashHead />);
    const overlay = container.querySelector('[data-testid="flash-head"]');
    expect(overlay).toBeTruthy();
  });

  it('flashBody renders a body overlay element', () => {
    const { container } = render(<FighterRig {...baseProps} flashBody />);
    const overlay = container.querySelector('[data-testid="flash-body"]');
    expect(overlay).toBeTruthy();
  });
});
