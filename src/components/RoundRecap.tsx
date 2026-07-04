import type { RoundReport } from '../domain/combat/report';

interface Props {
  report: RoundReport;
}

function DeltaChip({ label, value, color }: { label: string; value: number; color: string }) {
  if (value === 0) return null;

  return (
    <span className={`rounded px-1 py-0.5 font-mono text-xs ${color}`}>
      {label} −{value}
    </span>
  );
}

export default function RoundRecap({ report }: Props) {
  const {
    round,
    headline,
    detail,
    playerHeadDelta,
    playerBodyDelta,
    opponentHeadDelta,
    opponentBodyDelta,
  } = report;

  return (
    <div data-testid="round-recap" className="flex w-full flex-col gap-xs rounded bg-surface-container p-md">
      <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
        Round {round} recap
      </p>
      <h2 className="font-display text-xl leading-tight text-on-surface">{headline}</h2>
      <p className="font-body text-sm text-on-surface-variant">{detail}</p>
      <div className="mt-xs flex flex-wrap gap-1">
        {(opponentHeadDelta > 0 || opponentBodyDelta > 0) && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Opp:</span>
        )}
        <DeltaChip label="head" value={opponentHeadDelta} color="text-red-400" />
        <DeltaChip label="body" value={opponentBodyDelta} color="text-orange-400" />
        {(playerHeadDelta > 0 || playerBodyDelta > 0) && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">You:</span>
        )}
        <DeltaChip label="head" value={playerHeadDelta} color="text-red-400" />
        <DeltaChip label="body" value={playerBodyDelta} color="text-orange-400" />
      </div>
    </div>
  );
}
