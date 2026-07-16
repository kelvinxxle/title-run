import {
  STRIKE_PALETTE,
  STRIKES,
  type ExchangeMove,
  MOVE_KIND_LABELS,
  PHASE_OFFENSE,
  STAT_LABELS,
  type StatLine,
} from '../domain/combat';

interface Props {
  statLine: StatLine;
  exchange: number;
  exchangesPerRound: number;
  onMove: (m: ExchangeMove) => void;
  disabled?: boolean;
}

export default function StrikePanel({
  statLine,
  exchange,
  exchangesPerRound,
  onMove,
  disabled = false,
}: Props) {
  return (
    <div data-testid="strike-panel" className="w-full flex flex-col gap-sm">
      <p className="font-mono text-xs text-on-surface-variant uppercase tracking-widest">
        {STAT_LABELS[PHASE_OFFENSE.strike]}{' '}
        <span className="text-on-surface">{statLine[PHASE_OFFENSE.strike]}</span>
      </p>

      <div className="grid grid-cols-2 gap-xs">
        {STRIKE_PALETTE.map((id) => {
          const s = STRIKES[id];
          return (
            <button
              key={id}
              type="button"
              data-testid={`strike-${id}`}
              disabled={disabled}
              onClick={() => onMove({ kind: 'strike', strike: id })}
              className="flex flex-col gap-1 p-sm bg-surface-container border border-outline text-left disabled:opacity-50"
            >
              <span className="font-mono text-xs uppercase tracking-widest text-on-surface">
                {s.label}
              </span>
              <span className="font-mono text-xs text-on-surface-variant">{s.blurb}</span>
              <span className="font-mono text-xs uppercase tracking-widest text-primary border border-primary px-1">
                {s.target}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="strike-takedown"
        disabled={disabled}
        onClick={() => onMove({ kind: 'takedown', takedownType: 'double-leg' })}
        className="w-full h-16 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide disabled:opacity-50"
      >
        {MOVE_KIND_LABELS.takedown}
      </button>

      <p className="font-mono text-xs text-on-surface-variant text-center uppercase tracking-widest">
        Exchange {exchange} of {exchangesPerRound}
      </p>
    </div>
  );
}
