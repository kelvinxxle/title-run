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

export interface DraftedFighter {
  name: string;
  statLine: StatLine;
  slots: Record<StatId, SlotFill>;
}

export function keepStat(state: DraftState, statId: StatId): DraftState {
  if (state.status !== 'drafting') {
    throw new Error(`keepStat: cannot keep in status "${state.status}"`);
  }
  if (!state.current) {
    throw new Error('keepStat: no fighter on offer');
  }
  if (state.slots[statId] !== null) {
    throw new Error(`keepStat: slot "${statId}" is already filled`);
  }
  const slots: Record<StatId, SlotFill | null> = {
    ...state.slots,
    [statId]: {
      value: state.current.statLine[statId],
      sourceFighterId: state.current.fighterId,
    },
  };
  const remaining = STAT_IDS.filter((stat) => slots[stat] === null);
  if (remaining.length === 0) {
    return { ...state, slots, current: null, status: 'naming' };
  }
  const next = rollFor(state.seed, state.rollCount, state.rolledFighterIds);
  return {
    ...state,
    slots,
    current: next,
    rollCount: state.rollCount + 1,
    rolledFighterIds: [...state.rolledFighterIds, next.fighterId],
  };
}

export function nameFighter(state: DraftState, name: string): DraftState {
  if (state.status !== 'naming') {
    throw new Error(`nameFighter: cannot name in status "${state.status}"`);
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('nameFighter: name cannot be empty');
  }
  return { ...state, name: trimmed, status: 'complete' };
}

export function getDraftedFighter(state: DraftState): DraftedFighter {
  if (state.status !== 'complete' || state.name === null) {
    throw new Error('getDraftedFighter: draft is not complete');
  }
  const slots = {} as Record<StatId, SlotFill>;
  const statLine = {} as StatLine;
  for (const stat of STAT_IDS) {
    const fill = state.slots[stat];
    if (fill === null) {
      throw new Error(`getDraftedFighter: slot "${stat}" is unexpectedly empty`);
    }
    slots[stat] = fill;
    statLine[stat] = fill.value;
  }
  return { name: state.name, statLine, slots };
}
