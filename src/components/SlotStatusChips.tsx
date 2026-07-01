import { STAT_IDS, STAT_LABELS } from '../domain/stats';
import type { DraftState } from '../domain/draft';

interface SlotStatusChipsProps {
  slots: DraftState['slots'];
}

export default function SlotStatusChips({ slots }: SlotStatusChipsProps) {
  return (
    <div className="w-full max-w-lg mt-lg">
      <h4 className="font-mono text-xs uppercase tracking-widest text-on-surface-variant mb-xs text-center">
        Fighter Profile Status
      </h4>
      <div className="flex flex-wrap justify-center gap-xs">
        {STAT_IDS.map((stat) => {
          const filled = slots[stat] !== null;
          return (
            <span
              key={stat}
              data-testid={`chip-${stat}`}
              className={`font-mono text-[10px] uppercase px-2 py-1 border ${
                filled
                  ? 'border-outline bg-surface-container-high text-on-surface'
                  : 'border-outline-variant border-dashed text-on-surface-variant opacity-40'
              }`}
            >
              {STAT_LABELS[stat]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
