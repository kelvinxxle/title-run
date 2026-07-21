import StatRow, { type StatRowState } from './StatRow';
import { STAT_IDS, type StatId } from '../domain/combat';
import { getFighter } from '../domain/combat';
import { suggestedStatId, type DraftState } from '../domain/combat';
import FighterImage from './FighterImage';
import { heroFraming } from './heroFraming';

interface RolledFighterCardProps {
  state: DraftState;
  onKeep: (statId: StatId) => void;
}

export default function RolledFighterCard({ state, onKeep }: RolledFighterCardProps) {
  if (!state.current) {
    return null;
  }
  const fighter = getFighter(state.current.fighterId);
  const suggested = suggestedStatId(state);
  const current = state.current;
  return (
    <div className="w-full max-w-lg bg-surface-container border-2 border-outline p-md">
      <div data-testid="draft-hero" className="relative h-64 w-[calc(100%+48px)] -ml-md -mt-md mb-md overflow-hidden border-b-2 border-outline">
        <FighterImage fighterId={fighter.id} name={fighter.name} archetype={fighter.archetype} variant="hero" objectPosition={heroFraming(fighter.id)} />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-4xl uppercase leading-none text-primary drop-shadow">
            {fighter.name}
          </h3>
          <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
            {fighter.archetype}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-xs">
        {STAT_IDS.map((stat) => {
          const fill = state.slots[stat];
          const rowState: StatRowState = fill
            ? 'filled'
            : stat === suggested
              ? 'suggested'
              : 'available';
          const value = fill ? fill.value : current.statLine[stat];
          return (
            <StatRow
              key={stat}
              statId={stat}
              value={value}
              state={rowState}
              onSelect={onKeep}
            />
          );
        })}
      </div>
      <p className="font-mono text-[10px] text-center text-on-surface-variant mt-sm tracking-widest uppercase">
        Select one stat to permanently assign
      </p>
    </div>
  );
}
