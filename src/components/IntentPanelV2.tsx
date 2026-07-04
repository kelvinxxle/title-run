import { useState } from 'react';
import {
  WHERES, TARGETS, APPROACHES, INTENT_LABELS, PHASE_OFFENSE, STAT_LABELS,
  type Where, type Target, type Approach, type RoundIntent, type StatLine,
} from '../domain/combat';

interface Props { statLine: StatLine; onCommit: (intent: RoundIntent) => void; disabled?: boolean; }

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
  const [where, setWhere] = useState<Where>('strike');
  const [target, setTarget] = useState<Target>('head');
  const [approach, setApproach] = useState<Approach>('technical');

  const offenseStat = PHASE_OFFENSE[where];

  return (
    <div data-testid="intent-panel-v2" className="w-full flex flex-col gap-sm">
      <Segmented group="where" options={WHERES} value={where} labels={INTENT_LABELS.where} onSelect={setWhere} />
      <p className="font-mono text-xs text-on-surface-variant">
        {STAT_LABELS[offenseStat]} <span className="text-on-surface">{statLine[offenseStat]}</span>
      </p>
      <Segmented group="target" options={TARGETS} value={target} labels={INTENT_LABELS.target} onSelect={setTarget} />
      <Segmented group="approach" options={APPROACHES} value={approach} labels={INTENT_LABELS.approach} onSelect={setApproach} />
      <button
        type="button"
        data-testid="intent-commit"
        disabled={disabled}
        onClick={() => onCommit({ where, target, approach })}
        className="w-full h-16 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide disabled:opacity-50"
      >
        Attack
      </button>
    </div>
  );
}
