import { useState } from 'react';
import {
  startFight,
  resolveRound,
  durability,
  type FightState,
  type Intent,
  type StatLine,
} from '../domain';
import FighterHealthCard from '../components/FighterHealthCard';
import IntentPanel from '../components/IntentPanel';
import { opponentRead } from './fightCopy';

export interface FightScreenProps {
  seed: string;
  fightNumber: number;
  fighter: { name: string; statLine: StatLine };
  carriedDamage?: number;
  onSettled: (fight: FightState) => void;
}

function health(damage: number, statLine: StatLine): number {
  return 1 - damage / durability(statLine);
}

export function advanceFight(state: FightState, intent: Intent): FightState {
  return state.status === 'in-progress' ? resolveRound(state, intent) : state;
}

export default function FightScreen({ seed, fightNumber, fighter, carriedDamage = 0, onSettled }: FightScreenProps) {
  const [state, setState] = useState<FightState>(() =>
    startFight({ seed, fightNumber, playerStatLine: fighter.statLine, carryInDamage: carriedDamage }),
  );

  function handleIntent(intent: Intent) {
    const next = advanceFight(state, intent);
    setState(next);
    if (state.status === 'in-progress' && next.status !== 'in-progress') {
      onSettled(next);
    }
  }

  const inProgress = state.status === 'in-progress';

  return (
    <section data-testid="screen-fight" className="p-md flex flex-col items-center gap-md">
      <header className="w-full max-w-3xl text-center flex flex-col gap-base">
        <h2 className="font-display text-3xl uppercase tracking-wide text-primary">
          Fight {state.fightNumber}
        </h2>
        {inProgress && (
          <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
            Round {state.round} of {state.rounds}
          </p>
        )}
      </header>

      <div className="w-full max-w-3xl flex flex-col md:flex-row gap-sm">
        <FighterHealthCard
          side="opponent"
          name={state.opponent.name}
          subtitle={`${state.opponent.style.toUpperCase()} · CHALLENGER`}
          badge="DANGER"
          healthPct={health(state.opponent.damage, state.opponent.statLine)}
          read={opponentRead(state.opponent)}
        />
        <FighterHealthCard
          side="player"
          name={fighter.name}
          subtitle="YOUR FIGHTER"
          badge="YOU"
          healthPct={health(state.player.damage, state.player.statLine)}
        />
      </div>

      <div className="w-full max-w-3xl">
        {inProgress && <IntentPanel statLine={state.player.statLine} onIntent={handleIntent} />}
      </div>
    </section>
  );
}
