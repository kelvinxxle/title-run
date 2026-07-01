import { STAT_IDS, type StatId, type StatLine } from './stats';
import { createRng } from './rng';
import { buildStatLine, rollFighter, type Fighter } from './roster';

export type DraftStatus = 'drafting' | 'naming' | 'complete';

export interface SlotFill {
  value: number;
  sourceFighterId: string;
}

export interface RolledFighter {
  fighterId: string;
  statLine: StatLine;
}

export interface DraftState {
  seed: string;
  rollCount: number;
  rolledFighterIds: string[];
  current: RolledFighter | null;
  slots: Record<StatId, SlotFill | null>;
  status: DraftStatus;
  name: string | null;
}

function emptySlots(): Record<StatId, SlotFill | null> {
  const slots = {} as Record<StatId, SlotFill | null>;
  for (const stat of STAT_IDS) {
    slots[stat] = null;
  }
  return slots;
}

function rollFor(
  seed: string,
  rollCount: number,
  exclude: readonly string[],
): RolledFighter {
  const rng = createRng(`${seed}#${rollCount}`);
  const fighter: Fighter = rollFighter(rng, exclude);
  return { fighterId: fighter.id, statLine: buildStatLine(fighter) };
}

export function startDraft(seed: string): DraftState {
  const first = rollFor(seed, 0, []);
  return {
    seed,
    rollCount: 1,
    rolledFighterIds: [first.fighterId],
    current: first,
    slots: emptySlots(),
    status: 'drafting',
    name: null,
  };
}

export function availableStatIds(state: DraftState): StatId[] {
  return STAT_IDS.filter((stat) => state.slots[stat] === null);
}

export function filledCount(state: DraftState): number {
  return STAT_IDS.length - availableStatIds(state).length;
}

export function suggestedStatId(state: DraftState): StatId | null {
  if (!state.current) {
    return null;
  }
  const line = state.current.statLine;
  let best: StatId | null = null;
  let bestValue = -1;
  for (const stat of availableStatIds(state)) {
    if (line[stat] > bestValue) {
      bestValue = line[stat];
      best = stat;
    }
  }
  return best;
}
