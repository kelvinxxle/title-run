import type { RoundLogEntry } from '../domain/combat/fightState';

interface Props {
  log: RoundLogEntry[];
  rounds: number;
}

export default function MomentumBar({ log, rounds }: Props) {
  return (
    <div data-testid="momentum-bar" className="flex w-full justify-center gap-1">
      {Array.from({ length: rounds }, (_, i) => {
        const entry = log[i];
        const winner = entry?.winner ?? 'none';
        const color
          = winner === 'player' ? 'bg-primary'
            : winner === 'opponent' ? 'bg-secondary'
              : winner === 'draw' ? 'bg-yellow-400'
                : 'bg-surface-container-highest';

        return (
          <span
            key={i}
            data-winner={winner}
            className={`h-3 w-6 rounded-sm ${color} transition-colors duration-300`}
          />
        );
      })}
    </div>
  );
}
