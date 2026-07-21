import { fighterPalette } from './fighterPalette';
import { POSES, type PoseName } from '../replay/poses';

export interface FighterRigProps {
  seed: string;
  archetype: string;
  name: string;
  pose: PoseName;
  facing: 'left' | 'right';
  flashHead?: boolean;
  flashBody?: boolean;
  downed?: boolean;
}

// Layout constants (viewBox 0 0 160 220)
const CX = 80;
const HEAD_CY = 42;
const HEAD_RX = 11;
const HEAD_RY = 13;
const SHOULDER_Y = 82;
const LEAD_SHOULDER_X = 100;
const REAR_SHOULDER_X = 60;
const TORSO_TOP_Y = 68;
const TORSO_HEIGHT = 70;
const HIP_PIVOT_Y = 138;
const UPPER_ARM = 22;
const MAX_FOREARM = 32;
const GLOVE_R = 9;

export default function FighterRig({
  seed,
  archetype,
  name,
  pose,
  facing,
  flashHead,
  flashBody,
  downed,
}: FighterRigProps): JSX.Element {
  const { skin, glove, accent } = fighterPalette(seed, archetype);
  const p = POSES[pose];

  const forearmLead = MAX_FOREARM * p.leadArm.extend;
  const forearmRear = MAX_FOREARM * p.rearArm.extend;
  const leadArmTransform = `translate(${LEAD_SHOULDER_X + p.lean},${SHOULDER_Y}) rotate(${-p.leadArm.rotate})`;
  const rearArmTransform = `translate(${REAR_SHOULDER_X + p.lean},${SHOULDER_Y}) rotate(${-p.rearArm.rotate})`;

  const rigBody = (
    <>
      {/* legs */}
      <rect x={62} y={148} width={18} height={62} rx={5} fill={accent} />
      <rect x={80} y={148} width={18} height={62} rx={5} fill={accent} />
      {/* feet */}
      <rect x={58} y={204} width={23} height={9} rx={4} fill={skin} />
      <rect x={79} y={204} width={23} height={9} rx={4} fill={skin} />

      {/* rear arm (rendered behind torso) */}
      <g data-testid="rig-rear-arm" transform={rearArmTransform}>
        <rect x={0} y={-5} width={UPPER_ARM} height={10} rx={4} fill={skin} />
        <circle cx={UPPER_ARM} cy={0} r={5.5} fill={skin} />
        <rect x={UPPER_ARM} y={-4} width={forearmRear} height={8} rx={3} fill={skin} />
        <circle cx={UPPER_ARM + forearmRear} cy={0} r={GLOVE_R} fill={glove} />
      </g>

      {/* torso + neck + head (lean + torso-rotate applied here) */}
      <g transform={`translate(${p.lean},0)`}>
        <g transform={`rotate(${p.torsoRotate},${CX},${HIP_PIVOT_Y})`}>
          <rect x={CX - 25} y={TORSO_TOP_Y} width={50} height={TORSO_HEIGHT} rx={6} fill={accent} />
          {/* neck */}
          <rect x={CX - 7} y={TORSO_TOP_Y - 13} width={14} height={14} rx={3} fill={skin} />
          {/* head */}
          <ellipse
            cx={CX + p.headX}
            cy={HEAD_CY + p.headY}
            rx={HEAD_RX}
            ry={HEAD_RY}
            fill={skin}
          />
          {/* brow accent */}
          <rect
            x={CX - HEAD_RX + 1 + p.headX}
            y={HEAD_CY - 4 + p.headY}
            width={(HEAD_RX - 1) * 2}
            height={2}
            fill={accent}
          />
          {/* eyes */}
          <circle cx={CX - 4 + p.headX} cy={HEAD_CY + 1 + p.headY} r={1.5} fill="#0b0b0b" />
          <circle cx={CX + 4 + p.headX} cy={HEAD_CY + 1 + p.headY} r={1.5} fill="#0b0b0b" />
          {/* flash overlays */}
          {flashHead && (
            <rect
              data-testid="flash-head"
              x={CX - HEAD_RX + p.headX}
              y={HEAD_CY - HEAD_RY + p.headY}
              width={HEAD_RX * 2}
              height={HEAD_RY * 2}
              rx={HEAD_RX}
              fill="rgba(255,255,255,0.5)"
            />
          )}
          {flashBody && (
            <rect
              data-testid="flash-body"
              x={CX - 25}
              y={TORSO_TOP_Y}
              width={50}
              height={TORSO_HEIGHT}
              rx={6}
              fill="rgba(255,255,255,0.4)"
            />
          )}
        </g>
      </g>

      {/* lead arm (rendered in front of torso) */}
      <g data-testid="rig-lead-arm" transform={leadArmTransform}>
        <rect x={0} y={-5} width={UPPER_ARM} height={10} rx={4} fill={skin} />
        <circle cx={UPPER_ARM} cy={0} r={5.5} fill={skin} />
        <rect x={UPPER_ARM} y={-4} width={forearmLead} height={8} rx={3} fill={skin} />
        <circle cx={UPPER_ARM + forearmLead} cy={0} r={GLOVE_R} fill={glove} />
      </g>
    </>
  );

  const rigWithDowned = downed ? (
    <g transform={`rotate(80,${CX},130) translate(0,30)`}>{rigBody}</g>
  ) : rigBody;

  const innerContent =
    facing === 'left' ? (
      <g transform="scale(-1,1) translate(-160,0)">{rigWithDowned}</g>
    ) : (
      rigWithDowned
    );

  return (
    <svg
      data-testid="fighter-rig"
      data-pose={pose}
      data-facing={facing}
      role="img"
      aria-label={`${name} ${pose}`}
      viewBox="0 0 160 220"
      xmlns="http://www.w3.org/2000/svg"
      width={160}
      height={220}
    >
      {innerContent}
    </svg>
  );
}
