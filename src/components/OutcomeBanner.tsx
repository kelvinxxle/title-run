import type { FightOutcome } from '../domain';

interface OutcomeBannerProps {
  outcome: FightOutcome;
  heading?: string;
}

export default function OutcomeBanner({ outcome, heading }: OutcomeBannerProps) {
  const won = outcome.winner === 'player';
  return (
    <div data-testid="outcome-banner" className="w-full flex flex-col items-center gap-sm p-md bg-surface-container border border-outline">
      {heading && <p className="font-display text-base uppercase tracking-widest text-on-surface-variant">{heading}</p>}
      <p className={`font-display text-4xl uppercase tracking-wide ${won ? 'text-primary' : 'text-secondary'}`}>{won ? 'You Win' : 'You Lose'}</p>
      <p className="font-mono text-sm uppercase tracking-widest text-on-surface-variant">{outcome.method.toUpperCase()} · Round {outcome.round}</p>
    </div>
  );
}
