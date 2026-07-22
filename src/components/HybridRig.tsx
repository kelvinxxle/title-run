import { memo, useLayoutEffect, useRef } from 'react';
import { RIG_POSES, type RigPose } from '../replay/rigPoses';
import type { PoseName } from '../replay/poses';
import { fighterPalette } from './fighterPalette';
import type { ArchetypeId } from '../domain/combat/archetypes';

export interface HybridRigProps {
  side: 'player' | 'opponent';
  fighterId?: string;
  name: string;
  archetype: ArchetypeId;
  cornerColor: string;
  pose: PoseName;
  facing: 'left' | 'right';
  flashHead: boolean;
  flashBody: boolean;
  flashLeg: boolean;
  downed: boolean;
}

// BASE joint pivots (local space) — transcribed from the approved prototype.
const BASE: Record<keyof Omit<RigPose, 'bodyY' | 'rigX'>, [number, number]> = {
  torso: [90, 200], head: [0, -130],
  armLead: [18, -80], foreLead: [0, 36],
  armRear: [-18, -80], foreRear: [0, 36],
  thighLead: [100, 200], shinLead: [0, 48],
  thighRear: [80, 200], shinRear: [0, 48],
};
const JOINTS = Object.keys(BASE) as (keyof typeof BASE)[];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function jointTransform(facing: 'left' | 'right', joint: keyof typeof BASE, deg: number): string {
  const [bx, by] = BASE[joint];
  const headExtra = joint === 'head' && facing === 'right' ? ' scale(-1,1)' : '';
  return `translate(${bx},${by}) rotate(${deg},0,0)${headExtra}`;
}

export const HybridRig = memo(function HybridRig(props: HybridRigProps) {
  const { side, name, archetype, cornerColor, pose, facing, flashHead, flashBody, flashLeg, downed } = props;
  const rootRef = useRef<SVGGElement | null>(null);
  const prevPose = useRef<PoseName>(pose);

  const pal = fighterPalette(props.fighterId ?? name, archetype);
  const trunk = cornerColor;   // corner-colored trunk/shorts — documented exception to Octagon Elite tokens
  const skin = pal.skin;
  const glove = cornerColor;   // corner-colored gloves — documented exception to Octagon Elite tokens
  const torsoFill = '#33333d';
  const rp = RIG_POSES[pose];
  const isDown = downed || pose === 'down';

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prevPose.current === pose) return;
    const from = RIG_POSES[prevPose.current];
    prevPose.current = pose;
    if (prefersReducedMotion()) return;
    for (const j of JOINTS) {
      const el = root.querySelector(`[data-j="${j}"]`) as SVGGElement | null;
      if (!el || typeof el.animate !== 'function') continue;
      el.animate(
        [{ transform: jointTransform(facing, j, from[j]) }, { transform: jointTransform(facing, j, rp[j]) }],
        { duration: 150, easing: 'cubic-bezier(.34,1.2,.4,1)', fill: 'forwards' },
      );
    }
  }, [pose, facing, rp]);

  const facingTransform = facing === 'right' ? 'translate(180,0) scale(-1,1)' : '';
  const rootTransform = `translate(${rp.rigX},0)` + (isDown ? ' rotate(80,90,250)' : '');

  const thigh = (part: string) => (
    <rect data-part={part} x={-7} y={-2} width={14} height={50} rx={0} fill={trunk} />
  );
  const shinSegment = () => (
    <>
      <rect x={-6} y={-2} width={12} height={46} rx={0} fill={skin} />
      <path d="M-7,43 L16,41 L17,51 L-8,52 Z" fill="#111" />
    </>
  );
  const glv = () => (
    <g>
      <rect x={-10} y={23} width={20} height={23} rx={0} fill={glove} />
      <rect x={6} y={27} width={8} height={12} rx={0} fill={glove} />
      <rect x={-8} y={29} width={16} height={3.5} rx={0} fill="rgba(0,0,0,.30)" />
      <rect x={-8} y={35} width={16} height={3} rx={0} fill="rgba(0,0,0,.22)" />
    </g>
  );
  const upper = () => <rect x={-6} y={-4} width={12} height={40} rx={0} fill={skin} />;
  const fore = () => (<><rect x={-5} y={-2} width={10} height={30} rx={0} fill={skin} />{glv()}</>);

  const head = (
    <g data-j="head" transform={jointTransform(facing, 'head', rp.head)}>
      <circle cx={0} cy={0} r={33} fill="#0b0b0d" />
      <circle cx={0} cy={0} r={30} fill={skin} />
      <circle cx={0} cy={0} r={30} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={2} />
      {flashHead && <circle data-flash="head" cx={0} cy={0} r={30} fill="#fff" opacity={0.55} />}
    </g>
  );

  return (
    <g data-layer="facing" transform={facingTransform}>
      <g ref={rootRef} data-rig={side} data-pose={pose} transform={rootTransform}>
        <ellipse cx={90} cy={288} rx={46} ry={12} fill="rgba(0,0,0,.35)" />
        <g className="rig-bob">
          <g data-part="body" transform={`translate(0,${rp.bodyY})`}>
            <g data-j="thighRear" transform={jointTransform(facing, 'thighRear', rp.thighRear)}>
              {thigh('thighRear')}
              <g data-j="shinRear" transform={jointTransform(facing, 'shinRear', rp.shinRear)}>{shinSegment()}</g>
            </g>
            <g data-j="thighLead" transform={jointTransform(facing, 'thighLead', rp.thighLead)}>
              {thigh('thighLead')}
              <g data-j="shinLead" transform={jointTransform(facing, 'shinLead', rp.shinLead)}>{shinSegment()}</g>
            </g>
            <path d="M71,195 Q90,191 109,195 L108,214 Q90,219 72,214 Z" fill={trunk} />
            {flashLeg && <rect data-flash="leg" x={62} y={196} width={56} height={70} rx={0} fill="#fff" opacity={0.4} />}
            <g data-j="torso" transform={jointTransform(facing, 'torso', rp.torso)}>
              <g data-j="armRear" transform={jointTransform(facing, 'armRear', rp.armRear)}>
                {upper()}
                <g data-j="foreRear" transform={jointTransform(facing, 'foreRear', rp.foreRear)}>{fore()}</g>
              </g>
              <path d="M-17,2 L-22,-78 Q0,-90 22,-78 L17,2 Q0,8 -17,2 Z" fill={torsoFill} />
              {flashBody && <rect data-flash="body" x={-22} y={-90} width={44} height={98} rx={0} fill="#fff" opacity={0.4} />}
              <rect x={-7} y={-98} width={14} height={22} rx={0} fill={skin} />
              <g data-j="armLead" transform={jointTransform(facing, 'armLead', rp.armLead)}>
                {upper()}
                <g data-j="foreLead" transform={jointTransform(facing, 'foreLead', rp.foreLead)}>{fore()}</g>
              </g>
              {head}
            </g>
          </g>
        </g>
      </g>
    </g>
  );
});
