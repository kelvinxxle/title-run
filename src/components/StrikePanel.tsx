import {
  STRIKE_PALETTE,
  STRIKES,
  type ExchangeMove,
  PHASE_OFFENSE,
  STAT_LABELS,
  type StatLine,
  TAKEDOWN_TYPES,
  TAKEDOWN_LABELS,
  TAKEDOWN_BLURBS,
} from '../domain/combat';

interface Props {
  statLine: StatLine;
  exchange: number;
  exchangesPerRound: number;
  onMove: (m: ExchangeMove) => void;
  disabled?: boolean;
  signatureCharge?: number;
  sigReady?: boolean;
}

export default function StrikePanel({
  statLine,
  exchange,
  exchangesPerRound,
  onMove,
  disabled = false,
  sigReady = false,
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

      <div className="grid grid-cols-2 gap-xs" data-testid="takedown-row">
        {TAKEDOWN_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`takedown-${t}`}
            disabled={disabled}
            onClick={() => onMove({ kind: 'takedown', takedownType: t })}
            className="flex flex-col gap-1 p-sm bg-surface-container border border-outline text-left disabled:opacity-50"
          >
            <span className="font-semibold">{TAKEDOWN_LABELS[t]}</span>
            <span className="block text-xs opacity-70">{TAKEDOWN_BLURBS[t]}</span>
          </button>
        ))}
      </div>

      {sigReady && (
        <button
          type="button"
          data-testid="strike-signature"
          disabled={disabled}
          onClick={() => onMove({ kind: 'signature' })}
          className="w-full flex flex-col items-center gap-1 p-sm bg-primary text-on-primary border-2 border-primary animate-pulse font-display text-xl uppercase tracking-widest disabled:opacity-50"
        >
          <span>⚡ SIGNATURE STRIKE ⚡</span>
          <span className="font-mono text-xs tracking-widest opacity-80">UNLEASH IT NOW</span>
        </button>
      )}

      <p className="font-mono text-xs text-on-surface-variant text-center uppercase tracking-widest">
        Exchange {exchange} of {exchangesPerRound}
      </p>
    </div>
  );
}
