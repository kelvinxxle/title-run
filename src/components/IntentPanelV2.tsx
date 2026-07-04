import { useState } from 'react';
import {
  STRIKE_TACTICS, TARGETS, KIND_LABELS, STRIKE_TACTIC_LABELS, TARGET_LABELS,
  PHASE_OFFENSE, STAT_LABELS,
  type Target, type StrikeTactic, type RoundIntent, type StatLine,
} from '../domain/combat';

interface Props { statLine: StatLine; onCommit: (intent: RoundIntent) => void; disabled?: boolean; }

type Kind = 'strike' | 'wrestle';
const KINDS: readonly Kind[] = ['strike', 'wrestle'] as const;

function Segmented<T extends string>(
  { group, options, value, labels, onSelect }:
  { group: string; options: readonly T[]; value: T; labels: Record<T,string>; onSelect: (v: T) => void },
) {
  return (
    <div role="group" aria-label={group} className="flex gap-xs">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          data-testid={`${group}-${opt}`}
          aria-pressed={value === opt}
          onClick={() => onSelect(opt)}
          className={`flex-1 py-sm font-mono text-xs uppercase tracking-widest border ${
            value === opt ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-on-surface-variant border-outline'
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export default function IntentPanelV2({ statLine, onCommit, disabled = false }: Props) {
  const [kind, setKind] = useState<Kind>('strike');
  const [target, setTarget] = useState<Target>('head');
  const [tactic, setTactic] = useState<StrikeTactic>('pickApart');

  const commit = () => {
    onCommit(kind === 'strike' ? { kind: 'strike', target, tactic } : { kind: 'wrestle' });
  };

  return (
    <div data-testid="intent-panel-v2" className="w-full flex flex-col gap-sm">
      <Segmented group="kind" options={KINDS} value={kind} labels={KIND_LABELS} onSelect={setKind} />

      {kind === 'strike' ? (
        <>
          <p className="font-mono text-xs text-on-surface-variant">
            {STAT_LABELS[PHASE_OFFENSE.strike]} <span className="text-on-surface">{statLine[PHASE_OFFENSE.strike]}</span>
          </p>
          <Segmented group="target" options={TARGETS} value={target} labels={TARGET_LABELS} onSelect={setTarget} />
          <Segmented group="tactic" options={STRIKE_TACTICS} value={tactic} labels={STRIKE_TACTIC_LABELS} onSelect={setTactic} />
          <button
            type="button"
            data-testid="intent-commit"
            disabled={disabled}
            onClick={commit}
            className="w-full h-16 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide disabled:opacity-50"
          >
            Attack
          </button>
        </>
      ) : (
        <>
          <p className="font-mono text-xs text-on-surface-variant">
            {STAT_LABELS[PHASE_OFFENSE.wrestle]} <span className="text-on-surface">{statLine[PHASE_OFFENSE.wrestle]}</span>
          </p>
          <button
            type="button"
            data-testid="intent-commit"
            disabled={disabled}
            onClick={commit}
            className="w-full h-16 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide disabled:opacity-50"
          >
            Shoot for the takedown
          </button>
        </>
      )}
    </div>
  );
}
