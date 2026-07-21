import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FighterImage from './FighterImage';

describe('FighterImage', () => {
  it('renders the fighter photo keyed by id (base-prefixed src, alt=name)', () => {
    render(<FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" />);
    const img = screen.getByTestId('fighter-photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/fighters\/jon-jones\.jpg$/);
    expect(img).toHaveAttribute('alt', 'Jon Jones');
    // avatar fallback not shown while the photo is present
    expect(screen.queryByLabelText('Jon Jones portrait')).toBeNull();
  });

  it('falls back to the procedural avatar when the image errors', () => {
    render(<FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" />);
    fireEvent.error(screen.getByTestId('fighter-photo'));
    expect(screen.getByLabelText('Jon Jones portrait')).toBeInTheDocument();
    expect(screen.queryByTestId('fighter-photo')).toBeNull();
  });

  it('renders the avatar directly when no fighterId (player custom fighter)', () => {
    render(<FighterImage name="Kid Dynamite" archetype="brawler" />);
    expect(screen.getByLabelText('Kid Dynamite portrait')).toBeInTheDocument();
    expect(screen.queryByTestId('fighter-photo')).toBeNull();
  });

  it('resets errored state when fighterId changes to a new fighter', () => {
    // First render with a fighter whose image errors
    const { rerender } = render(
      <FighterImage fighterId="journeyman-doe" name="Danny Doe" archetype="brawler" />,
    );
    fireEvent.error(screen.getByTestId('fighter-photo'));
    // Avatar shown after error
    expect(screen.getByLabelText('Danny Doe portrait')).toBeInTheDocument();
    expect(screen.queryByTestId('fighter-photo')).toBeNull();

    // Rerender with a DIFFERENT valid fighter — errored state must NOT carry over
    rerender(<FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" />);
    const img = screen.getByTestId('fighter-photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/fighters\/jon-jones\.jpg$/);
    expect(img).toHaveAttribute('alt', 'Jon Jones');
    // procedural avatar must NOT be visible for the new fighter
    expect(screen.queryByLabelText('Jon Jones portrait')).toBeNull();
  });

  it('applies a default face-biased object-position, overridable via prop', () => {
    const { rerender } = render(
      <FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" variant="hero" />,
    );
    expect((screen.getByTestId('fighter-photo') as HTMLImageElement).style.objectPosition).toBe(
      '50% 20%',
    );
    rerender(
      <FighterImage
        fighterId="jon-jones"
        name="Jon Jones"
        archetype="allrounder"
        variant="hero"
        objectPosition="50% 8%"
      />,
    );
    expect((screen.getByTestId('fighter-photo') as HTMLImageElement).style.objectPosition).toBe(
      '50% 8%',
    );
  });
});
