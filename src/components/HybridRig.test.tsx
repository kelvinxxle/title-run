import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HybridRig } from './HybridRig';
import { RIG_POSES } from '../replay/rigPoses';

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
    const head = container.querySelector('[data-j="head"]') as HTMLElement;
    expect(head.style.transform).toContain('scale(-1,1)');
  });

  it('does NOT mirror when facing left (opponent)', () => {
    const { container } = renderRig({ side: 'opponent', facing: 'left' });
    const facing = container.querySelector('[data-layer="facing"]');
    expect(facing!.getAttribute('transform') ?? '').not.toContain('scale(-1,1)');
  });

  it('sets each joint target transform from RIG_POSES (instant path in jsdom)', () => {
    const { container } = renderRig({ pose: 'kick-contact' });
    const thighRear = container.querySelector('[data-j="thighRear"]') as HTMLElement;
    // kick-contact thighRear = 62deg (see rigPoses.ts)
    expect(thighRear.style.transform).toContain('rotate(62deg)');
  });

  it('applies a single 80deg root rotation when downed (no double-rotation)', () => {
    const { container } = renderRig({ pose: 'down', downed: true });
    const root = container.querySelector('[data-rig="player"]');
    const t = root!.getAttribute('transform') ?? '';
    expect(t).toContain('rotate(80');
    // torso pose itself stays shallow (Task 1): assert torso CSS style not also ~80
    const torso = container.querySelector('[data-j="torso"]') as HTMLElement;
    expect(torso.style.transform).not.toContain('rotate(80');
  });
});

// FIX-1 RED: joints must expose CSS-valid transforms so Chrome WAAPI can interpolate
describe('HybridRig WAAPI CSS transform validity', () => {
  it('joint elements carry CSS-valid style.transform (px for translate, deg for rotate, no 3-arg SVG rotate)', () => {
    const { container } = renderRig({ pose: 'kick-contact' });
    const torso = container.querySelector('[data-j="torso"]') as HTMLElement;
    const t = torso.style.transform;
    expect(t).toMatch(/\dpx/);    // translate must use px units
    expect(t).toMatch(/\ddeg/);   // rotate must use deg units
    expect(t).not.toMatch(/rotate\([^)]*,[^)]*,[^)]*\)/); // no 3-arg SVG rotate
  });

  it('head joint CSS transform has scale(-1,1) and deg for right-facing rig (no 3-arg SVG rotate)', () => {
    const { container } = renderRig({ facing: 'right', pose: 'idle' });
    const head = container.querySelector('[data-j="head"]') as HTMLElement;
    const t = head.style.transform;
    expect(t).toContain('scale(-1,1)');
    expect(t).toMatch(/\ddeg/);
    expect(t).not.toMatch(/rotate\([^)]*,[^)]*,[^)]*\)/);
  });
});

// M19-C: rigX (step in/out) and bodyY (drop/rise) were plain SVG transform attributes, so they
// SNAPPED in a single frame while every limb eased over 150ms. M19-C widened their range ~4x
// (rigX span 6px -> 36px), turning a barely-visible seam into a visible teleport: knee-contact
// -> idle moves the whole rig 22px (~12% of the 180-unit rig width) instantly.
// They must ride the same WAAPI path as the joints. The knockdown root rotate stays an SVG attr.
describe('HybridRig root translation animates (M19-C)', () => {
  function stubAnimate(fn: (this: Element, kf: unknown) => Animation) {
    // jsdom implements no WAAPI at all, so there is nothing for vi.spyOn to wrap.
    Object.defineProperty(Element.prototype, 'animate', {
      value: fn, writable: true, configurable: true,
    });
  }

  afterEach(() => {
    delete (Element.prototype as unknown as Record<string, unknown>).animate;
  });

  it('drives rigX through a CSS transform joint, not an SVG transform attribute', () => {
    const { container } = renderRig({ pose: 'knee-contact' });
    const el = container.querySelector('[data-j="rigX"]') as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.transform).toBe(`translate(${RIG_POSES['knee-contact'].rigX}px,0px)`);
  });

  it('drives bodyY through a CSS transform joint, not an SVG transform attribute', () => {
    const { container } = renderRig({ pose: 'knee-contact' });
    const el = container.querySelector('[data-j="bodyY"]') as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.transform).toBe(`translate(0px,${RIG_POSES['knee-contact'].bodyY}px)`);
    // same element still carries the body part hook the flash overlays rely on
    expect(el!.getAttribute('data-part')).toBe('body');
    expect(el!.getAttribute('transform')).toBeNull();
  });

  it('leaves ONLY the knockdown rotate on the rig root SVG transform attribute', () => {
    const { container } = renderRig({ pose: 'knee-contact' });
    const root = container.querySelector('[data-rig="player"]')!;
    expect(root.getAttribute('transform') ?? '').not.toContain('translate');

    const { container: down } = renderRig({ pose: 'down', downed: true });
    const downRoot = down.querySelector('[data-rig="player"]')!;
    expect(downRoot.getAttribute('transform')).toContain('rotate(80');
    expect(downRoot.getAttribute('transform')).not.toContain('translate');
  });

  it('animates rigX and bodyY alongside every rotational joint on a pose change', () => {
    const animated: string[] = [];
    stubAnimate(function (this: Element) {
      animated.push(this.getAttribute('data-j') ?? '?');
      return { cancel: () => {} } as unknown as Animation;
    });

    const { container, rerender } = render(
      <svg>
        <HybridRig
          side="player" name="T" archetype="striker" cornerColor="#e23b2e"
          pose="idle" facing="right"
          flashHead={false} flashBody={false} flashLeg={false} downed={false}
        />
      </svg>,
    );
    rerender(
      <svg>
        <HybridRig
          side="player" name="T" archetype="striker" cornerColor="#e23b2e"
          pose="knee-contact" facing="right"
          flashHead={false} flashBody={false} flashLeg={false} downed={false}
        />
      </svg>,
    );

    expect(animated).toContain('rigX');
    expect(animated).toContain('bodyY');
    expect(animated).toContain('torso');
    expect(animated).toContain('thighRear');
    expect(container.querySelector('[data-j="rigX"]')).not.toBeNull();
  });

  it('interpolates rigX/bodyY from the OUTGOING pose value (no snap-then-ease)', () => {
    const frames: Record<string, unknown> = {};
    stubAnimate(function (this: Element, kf: unknown) {
      frames[this.getAttribute('data-j') ?? '?'] = kf;
      return { cancel: () => {} } as unknown as Animation;
    });

    const { rerender } = render(
      <svg>
        <HybridRig
          side="player" name="T" archetype="striker" cornerColor="#e23b2e"
          pose="knee-contact" facing="right"
          flashHead={false} flashBody={false} flashLeg={false} downed={false}
        />
      </svg>,
    );
    rerender(
      <svg>
        <HybridRig
          side="player" name="T" archetype="striker" cornerColor="#e23b2e"
          pose="idle" facing="right"
          flashHead={false} flashBody={false} flashLeg={false} downed={false}
        />
      </svg>,
    );

    expect(frames['rigX']).toEqual([
      { transform: `translate(${RIG_POSES['knee-contact'].rigX}px,0px)` },
      { transform: `translate(${RIG_POSES['idle'].rigX}px,0px)` },
    ]);
    expect(frames['bodyY']).toEqual([
      { transform: `translate(0px,${RIG_POSES['knee-contact'].bodyY}px)` },
      { transform: `translate(0px,${RIG_POSES['idle'].bodyY}px)` },
    ]);
  });
});

describe('HybridRig photo head', () => {
  it('renders a base-prefixed photo href when fighterId is given', () => {
    const { container } = renderRig({ fighterId: 'conor-mcgregor' });
    const img = container.querySelector('image');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('href')).toBe('/title-run/fighters/conor-mcgregor.jpg');
  });

  it('falls back to the procedural head on image error', () => {
    const { container } = renderRig({ fighterId: 'conor-mcgregor' });
    const img = container.querySelector('image')!;
    fireEvent.error(img);
    expect(container.querySelector('image')).toBeNull();          // photo gone
    expect(container.querySelector('[data-j="head"] circle')).not.toBeNull(); // procedural head shown
  });

  it('uses the procedural head (no image) when fighterId is omitted (custom player)', () => {
    const { container } = renderRig({ fighterId: undefined });
    expect(container.querySelector('image')).toBeNull();
  });

  it('uses deterministic semantic clip ids (no useId churn)', () => {
    const { container: a } = renderRig({ side: 'player', fighterId: 'jon-jones' });
    const { container: b } = renderRig({ side: 'player', fighterId: 'jon-jones' });
    const idA = a.querySelector('clipPath')!.getAttribute('id');
    const idB = b.querySelector('clipPath')!.getAttribute('id');
    // Cleanup A: keyed by (side, fighterId) to avoid collisions
    expect(idA).toBe('rig-clip-player-jon-jones');
    expect(idB).toBe('rig-clip-player-jon-jones');
  });
});
