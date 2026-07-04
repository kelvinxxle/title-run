import { FINISH_CHOICES, type FinishChoice, type FinishWindow } from '../domain/combat';

interface Props { window: FinishWindow; onChoice: (choice: FinishChoice) => void; disabled?: boolean; }

const OFFENSE_LABELS: Record<FinishChoice, string> = { commit: 'Commit', measure: 'Measure', hold: 'Reset' };
const DEFENSE_LABELS: Record<FinishChoice, string> = { commit: 'Fire Back', measure: 'Cover Up', hold: 'Clinch Up' };

export default function FinishSequencePanel({ window: win, onChoice, disabled = false }: Props) {
  const offense = win.side === 'player';
  const labels = offense ? OFFENSE_LABELS : DEFENSE_LABELS;
  const heading = offense
    ? `FINISH — ${win.method === 'KO' ? 'HE\u2019S ROCKED' : 'SUBMISSION IS THERE'}`
    : `DANGER — ${win.method === 'KO' ? 'YOU\u2019RE ROCKED' : 'DEFEND THE SUB'}`;

  return (
    <div
      data-testid="finish-panel"
      data-side={win.side}
      className={`w-full p-md flex flex-col gap-sm border-2 ${offense ? 'border-primary' : 'border-error'}`}
    >
      <h3 className={`font-display text-2xl uppercase tracking-wide ${offense ? 'text-primary' : 'text-error'}`}>{heading}</h3>
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
        Window closing — <span data-testid="finish-steps">{win.stepsLeft}</span> left
      </p>
      <div className="grid grid-cols-3 gap-xs">
        {FINISH_CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            data-testid={`finish-${choice}`}
            disabled={disabled}
            onClick={() => onChoice(choice)}
            className="py-md font-display text-lg uppercase bg-surface-container border border-outline disabled:opacity-50"
          >
            {labels[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}
