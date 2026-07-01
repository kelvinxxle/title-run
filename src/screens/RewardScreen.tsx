import { useState } from 'react';
import {
  STAT_IDS, STAT_LABELS, rewardDelta,
  type RunState, type Reward, type StatId,
} from '../domain';
import OutcomeBanner from '../components/OutcomeBanner';

export interface RewardScreenProps {
  run: RunState;
  onReward: (reward: Reward) => void;
}

type Step = 'type' | 'target';
type PickableType = 'bump' | 'reroll';

export default function RewardScreen({ run, onReward }: RewardScreenProps) {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<PickableType>('bump');
  const [selectedStat, setSelectedStat] = useState<StatId | null>(null);

  const outcome = run.fight?.outcome;

  function chooseType(type: PickableType) {
    setSelectedType(type);
    setSelectedStat(null);
    setStep('target');
  }

  function preview(): string {
    if (!selectedStat) return '';
    const d = rewardDelta(run, { type: selectedType, stat: selectedStat });
    return selectedType === 'reroll' ? `${d.from} → ??` : `${d.from} → ${d.to}`;
  }

  if (step === 'type') {
    return (
      <section data-testid="screen-reward">
        {outcome && <OutcomeBanner outcome={outcome} heading="Victory" />}
        <button data-testid="reward-type-bump" onClick={() => chooseType('bump')}>Bump a stat (+8)</button>
        <button data-testid="reward-type-reroll" onClick={() => chooseType('reroll')}>Re-roll a stat (gamble)</button>
        <button
          data-testid="reward-type-recover"
          disabled={run.carriedDamage === 0}
          onClick={() => onReward({ type: 'recover' })}
        >Recover (heal damage)</button>
      </section>
    );
  }

  return (
    <section data-testid="screen-reward">
      <div>{STAT_IDS.map((s) => (
        <button key={s} data-testid={`reward-stat-${s}`} onClick={() => setSelectedStat(s)}>
          {STAT_LABELS[s]}
        </button>
      ))}</div>
      <p data-testid="reward-preview">{preview()}</p>
      <button
        data-testid="reward-confirm"
        disabled={!selectedStat}
        onClick={() => selectedStat && onReward({ type: selectedType, stat: selectedStat })}
      >Confirm &amp; Continue</button>
      <button data-testid="reward-back" onClick={() => setStep('type')}>← Back to rewards</button>
    </section>
  );
}
