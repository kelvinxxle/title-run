export type GroundPosition = 'guard' | 'half-guard' | 'side-control' | 'mount' | 'back';
export type GroundAction = 'ground-and-pound' | 'advance' | 'submission';
export type SubmissionType = 'kimura' | 'arm-triangle' | 'armbar' | 'rear-naked-choke';

export interface GroundState {
  position: GroundPosition;
}

export const POSITION_LADDER: readonly GroundPosition[] = [
  'guard', 'half-guard', 'side-control', 'mount', 'back',
] as const;

export const POSITION_QUALITY: Record<GroundPosition, number> = {
  guard: 0, 'half-guard': 1, 'side-control': 2, mount: 3, back: 4,
};

export function nextPosition(p: GroundPosition): GroundPosition | null {
  const i = POSITION_LADDER.indexOf(p);
  return i >= 0 && i < POSITION_LADDER.length - 1 ? POSITION_LADDER[i + 1] : null;
}

/** Submission available FROM each position (null = none, e.g. neutral guard on top). */
export const POSITION_SUBMISSION: Record<GroundPosition, SubmissionType | null> = {
  guard: null,
  'half-guard': 'kimura',
  'side-control': 'arm-triangle',
  mount: 'armbar',
  back: 'rear-naked-choke',
};

export const GROUND_ACTIONS: readonly GroundAction[] = ['ground-and-pound', 'advance', 'submission'] as const;

export const GROUND_ACTION_LABELS: Record<GroundAction, string> = {
  'ground-and-pound': 'Ground & Pound',
  advance: 'Advance Position',
  submission: 'Submission',
};

export const GROUND_POSITION_LABELS: Record<GroundPosition, string> = {
  guard: 'In Guard',
  'half-guard': 'Half Guard',
  'side-control': 'Side Control',
  mount: 'Mount',
  back: 'Back Mount',
};

export const SUBMISSION_LABELS: Record<SubmissionType, string> = {
  kimura: 'Kimura',
  'arm-triangle': 'Arm-Triangle',
  armbar: 'Armbar',
  'rear-naked-choke': 'Rear-Naked Choke',
};
