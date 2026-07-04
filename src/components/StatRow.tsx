import StatBar from './StatBar';
import { STAT_LABELS, type StatId } from '../domain/combat';

export type StatRowState = 'available' | 'suggested' | 'filled';

interface StatRowProps {
  statId: StatId;
  value: number;
  state: StatRowState;
  onSelect?: (statId: StatId) => void;
}

export default function StatRow({ statId, value, state, onSelect }: StatRowProps) {
  const label = STAT_LABELS[statId];
  const highlighted = state === 'suggested';
  const className = `flex items-center justify-between gap-sm p-xs w-full text-left border-2 ${
    highlighted ? 'border-primary bg-primary/10' : 'border-transparent'
  } ${state === 'filled' ? 'opacity-40' : ''}`;
  const body = (
    <>
      <span className="font-mono text-xs uppercase tracking-widest text-on-surface w-28">
        {label}
      </span>
      <StatBar value={value} highlighted={highlighted} />
      <span className="font-mono text-lg text-on-surface w-10 text-right">{value}</span>
    </>
  );

  if (state !== 'filled' && onSelect) {
    return (
      <button
        type="button"
        data-testid={highlighted ? 'suggested-stat' : undefined}
        aria-label={`Keep ${label} ${value}`}
        onClick={() => onSelect(statId)}
        className={className}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      data-testid={`filled-stat-${statId}`}
      aria-label={`${label} ${value} filled`}
      className={className}
    >
      {body}
    </div>
  );
}
