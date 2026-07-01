import type { FightOutcome } from '../domain';

interface FightResultPanelProps {
  outcome: FightOutcome;
  onNewFight: () => void;
}

export default function FightResultPanel({ outcome, onNewFight }: FightResultPanelProps) {
  const won = outcome.winner === 'player';
  return (
    <div
      data-testid="fight-result"
      className="w-full flex flex-col items-center gap-sm p-md bg-surface-container border border-outline"
    >
      <p
        className={`font-display text-4xl uppercase tracking-wide ${won ? 'text-primary' : 'text-secondary'}`}
      >
        {won ? 'You Win' : 'You Lose'}
      </p>
      <p className="font-mono text-sm uppercase tracking-widest text-on-surface-variant">
        {outcome.method.toUpperCase()} · Round {outcome.round}
      </p>
      <button
        type="button"
        onClick={onNewFight}
        className="mt-sm h-12 px-lg bg-primary text-on-primary font-display text-lg uppercase tracking-wide"
      >
        New Fight
      </button>
    </div>
  );
}
