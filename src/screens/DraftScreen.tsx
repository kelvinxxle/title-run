import { useState } from 'react';
import { STAT_IDS, STAT_LABELS, type StatId } from '../domain/stats';
import {
  startDraft,
  keepStat,
  nameFighter,
  filledCount,
  getDraftedFighter,
  type DraftState,
  type DraftedFighter,
} from '../domain/draft';
import DraftProgress from '../components/DraftProgress';
import RolledFighterCard from '../components/RolledFighterCard';
import SlotStatusChips from '../components/SlotStatusChips';
import NameFighterForm from '../components/NameFighterForm';

interface DraftScreenProps {
  seed?: string;
  onComplete?: (fighter: DraftedFighter) => void;
}

export default function DraftScreen({ seed, onComplete }: DraftScreenProps = {}) {
  const [state, setState] = useState<DraftState>(() =>
    startDraft(seed ?? String(Date.now())),
  );

  const handleKeep = (statId: StatId) => setState((s) => keepStat(s, statId));
  function handleName(name: string) {
    const named = nameFighter(state, name);
    setState(named);
    if (named.status === 'complete') {
      onComplete?.(getDraftedFighter(named));
    }
  }
  function handleRestart() {
    setState(startDraft(seed ?? String(Date.now())));
  }

  return (
    <section data-testid="screen-draft" className="p-md flex flex-col items-center">
      {state.status === 'drafting' && (
        <>
          <DraftProgress filled={filledCount(state)} total={STAT_IDS.length} />
          <RolledFighterCard state={state} onKeep={handleKeep} />
          <SlotStatusChips slots={state.slots} />
        </>
      )}

      {state.status === 'naming' && <NameFighterForm onSubmit={handleName} />}

      {state.status === 'complete' && (
        <div className="w-full max-w-md flex flex-col items-center gap-sm">
          <h2 className="font-display text-2xl uppercase text-primary">Fighter Ready</h2>
          <p
            data-testid="fighter-name"
            className="font-display text-4xl uppercase text-on-surface"
          >
            {state.name}
          </p>
          <div className="w-full flex flex-col gap-xs">
            {(() => {
              const drafted = getDraftedFighter(state);
              return STAT_IDS.map((stat) => (
                <div key={stat} className="flex justify-between font-mono text-sm">
                  <span className="uppercase tracking-widest text-on-surface-variant">
                    {STAT_LABELS[stat]}
                  </span>
                  <span className="text-on-surface">
                    {drafted.statLine[stat]}
                  </span>
                </div>
              ));
            })()}
          </div>
          <button
            type="button"
            onClick={handleRestart}
            className="mt-sm font-mono text-xs uppercase tracking-widest text-primary"
          >
            New Draft
          </button>
        </div>
      )}
    </section>
  );
}
