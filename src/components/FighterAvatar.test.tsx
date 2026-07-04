import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FighterAvatar from './FighterAvatar';
import fighterAvatarSource from './FighterAvatar.tsx?raw';
import { STARTER_ROSTER } from '../domain/combat';

function serialize(container: HTMLElement): string {
  const svg = container.querySelector('[data-testid="fighter-avatar"]');
  if (!svg) throw new Error('avatar svg not found');
  return svg.outerHTML;
}

describe('FighterAvatar', () => {
  it('is deterministic: same props render byte-identical SVG', () => {
    const props = { seed: 'israel-adesanya', archetype: 'striker', name: 'Israel Adesanya', size: 48 };
    const a = render(<FighterAvatar {...props} />);
    const b = render(<FighterAvatar {...props} />);
    expect(serialize(a.container)).toBe(serialize(b.container));
  });

  it('produces a distinct spread across the 40 roster fighters', () => {
    const outputs = new Set<string>();
    for (const f of STARTER_ROSTER) {
      const { container } = render(
        <FighterAvatar seed={f.id} archetype={f.archetype} name={f.name} />,
      );
      outputs.add(serialize(container));
    }
    expect(STARTER_ROSTER).toHaveLength(40);
    expect(outputs.size).toBeGreaterThanOrEqual(30);
  });

  it('applies the correct archetype accent color', () => {
    const accents: Record<string, string> = {
      striker: '#e23b2e',
      wrestler: '#2f6fe0',
      grappler: '#7c3aed',
      allrounder: '#22a34a',
      brawler: '#e8791f',
    };
    for (const [archetype, hex] of Object.entries(accents)) {
      const { container } = render(
        <FighterAvatar seed="seed-x" archetype={archetype} name="Test" />,
      );
      expect(serialize(container)).toContain(hex);
    }
  });

  it('falls back to neutral gray for unknown archetypes without throwing', () => {
    expect(() => {
      const { container } = render(
        <FighterAvatar seed="seed-y" archetype="unknown" name="Test" />,
      );
      expect(serialize(container)).toContain('#8a8f98');
    }).not.toThrow();

    const { container } = render(<FighterAvatar seed="seed-z" archetype="" name="Test" />);
    expect(serialize(container)).toContain('#8a8f98');
  });

  it('honors the size prop and defaults to 48', () => {
    const big = render(<FighterAvatar seed="s" archetype="striker" name="Big" size={96} />);
    const bigSvg = big.container.querySelector('[data-testid="fighter-avatar"]')!;
    expect(bigSvg.getAttribute('width')).toBe('96');
    expect(bigSvg.getAttribute('height')).toBe('96');

    const def = render(<FighterAvatar seed="s" archetype="striker" name="Def" />);
    const defSvg = def.container.querySelector('[data-testid="fighter-avatar"]')!;
    expect(defSvg.getAttribute('width')).toBe('48');
    expect(defSvg.getAttribute('height')).toBe('48');
  });

  it('exposes an accessible img role and label with the name', () => {
    render(<FighterAvatar seed="s" archetype="striker" name={'Kano "Ironjaw" Vega'} />);
    const el = screen.getByRole('img', { name: /Kano "Ironjaw" Vega portrait/ });
    expect(el).toBeInTheDocument();
  });

  it('does not use Math.random in source', () => {
    expect(fighterAvatarSource).not.toContain('Math.random');
  });
});
