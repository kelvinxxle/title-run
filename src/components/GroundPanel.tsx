import type { GroundState, GroundAction } from '../domain/combat';
import { GROUND_POSITION_LABELS, POSITION_SUBMISSION, SUBMISSION_LABELS, nextPosition } from '../domain/combat';

export default function GroundPanel({
  ground,
  onGroundAction,
  disabled = false,
}: {
  ground: GroundState;
  onGroundAction: (a: GroundAction) => void;
  disabled?: boolean;
}) {
  const sub = POSITION_SUBMISSION[ground.position];
  const canAdvance = nextPosition(ground.position) !== null;
  return (
    <div data-testid="ground-panel" className="w-full flex flex-col gap-sm">
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
        Top Control · {GROUND_POSITION_LABELS[ground.position]}
      </p>
      <div className="grid gap-xs">
        <button
          type="button"
          data-testid="ground-gnp"
          disabled={disabled}
          onClick={() => onGroundAction('ground-and-pound')}
          className="py-md font-display text-lg uppercase bg-surface-container border border-outline disabled:opacity-50"
        >
          Ground &amp; Pound
        </button>
        {canAdvance && (
          <button
            type="button"
            data-testid="ground-advance"
            disabled={disabled}
            onClick={() => onGroundAction('advance')}
            className="py-md font-display text-lg uppercase bg-surface-container border border-outline disabled:opacity-50"
          >
            Advance Position
          </button>
        )}
        {sub !== null && (
          <button
            type="button"
            data-testid="ground-sub"
            disabled={disabled}
            onClick={() => onGroundAction('submission')}
            className="py-md font-display text-lg uppercase bg-surface-container border border-outline disabled:opacity-50"
          >
            {SUBMISSION_LABELS[sub]}
          </button>
        )}
      </div>
    </div>
  );
}
