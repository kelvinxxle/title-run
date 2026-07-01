import { INTENTS, STAT_LABELS, type Intent, type StatLine } from '../domain';

interface IntentPanelProps {
  statLine: StatLine;
  onIntent: (intent: Intent) => void;
  disabled?: boolean;
}

const INTENT_LABELS: Record<Intent, string> = {
  strike: 'Strike',
  clinch: 'Clinch',
  takedown: 'Takedown',
  submit: 'Submit',
  outpoint: 'Out-point',
};

const GRID_INTENTS: Intent[] = ['clinch', 'takedown', 'submit', 'outpoint'];

function OffenseStats({ intent, statLine }: { intent: Intent; statLine: StatLine }) {
  const [a, b] = INTENTS[intent].offense;
  return (
    <span className="font-mono text-xs text-on-surface-variant flex gap-sm">
      <span>
        {STAT_LABELS[a]} <span className="text-on-surface">{statLine[a]}</span>
      </span>
      <span>
        {STAT_LABELS[b]} <span className="text-on-surface">{statLine[b]}</span>
      </span>
    </span>
  );
}

export default function IntentPanel({ statLine, onIntent, disabled = false }: IntentPanelProps) {
  const canFinish = (intent: Intent) => INTENTS[intent].finish !== null;

  return (
    <div data-testid="intent-panel" className="w-full flex flex-col gap-sm">
      <button
        type="button"
        data-testid="intent-strike"
        disabled={disabled}
        onClick={() => onIntent('strike')}
        className="w-full h-20 bg-primary text-on-primary flex flex-col items-center justify-center gap-base disabled:opacity-50"
      >
        <span className="font-display text-2xl uppercase tracking-wide">
          {INTENT_LABELS.strike}{' '}
          {canFinish('strike') && (
            <>
              <span aria-hidden="true">★</span>
              <span className="sr-only">Can finish</span>
            </>
          )}
        </span>
        <OffenseStats intent="strike" statLine={statLine} />
      </button>

      <div className="grid grid-cols-2 gap-sm">
        {GRID_INTENTS.map((intent) => (
          <button
            key={intent}
            type="button"
            data-testid={`intent-${intent}`}
            disabled={disabled}
            onClick={() => onIntent(intent)}
            className="bg-surface-container border border-outline p-sm flex flex-col items-start gap-base disabled:opacity-50"
          >
            <span className="font-display text-lg uppercase tracking-wide text-on-surface">
              {INTENT_LABELS[intent]}{' '}
              {canFinish(intent) && (
                <>
                  <span aria-hidden="true" className="text-primary">★</span>
                  <span className="sr-only">Can finish</span>
                </>
              )}
            </span>
            <OffenseStats intent={intent} statLine={statLine} />
          </button>
        ))}
      </div>
    </div>
  );
}
