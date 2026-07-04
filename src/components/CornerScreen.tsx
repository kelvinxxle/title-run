import type { RoundLogEntry } from '../domain/combat/fightState';
import { GAME_PLANS, GAME_PLAN_BLURBS, GAME_PLAN_LABELS, type GamePlan } from '../domain/combat/intents';
import type { RoundReport } from '../domain/combat/report';
import MomentumBar from './MomentumBar';
import RoundRecap from './RoundRecap';

interface Props {
  report: RoundReport | null;
  log: RoundLogEntry[];
  rounds: number;
  nextRound: number;
  onChoosePlan: (plan: GamePlan) => void;
}

export default function CornerScreen({ report, log, rounds, nextRound, onChoosePlan }: Props) {
  return (
    <div
      data-testid="corner-screen"
      className="flex w-full flex-col gap-md p-md"
    >
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
          Between Rounds
        </p>
        <h1 className="font-display text-3xl uppercase text-on-surface">
          Corner
        </h1>
        <p className="mt-xs font-mono text-xs uppercase tracking-widest text-on-surface-variant">
          Round {nextRound} up next
        </p>
      </div>

      {report && <RoundRecap report={report} />}

      <MomentumBar log={log} rounds={rounds} />

      <p className="text-center font-body text-sm italic text-on-surface-variant">
        "Pick your approach for round {nextRound}."
      </p>

      <div className="grid w-full grid-cols-2 gap-sm">
        {GAME_PLANS.map((plan) => (
          <button
            key={plan}
            type="button"
            data-testid={`plan-${plan}`}
            onClick={() => onChoosePlan(plan)}
            className="flex flex-col gap-xs border border-outline bg-surface-container p-sm text-left transition-colors hover:bg-surface-container-highest"
          >
            <span className="font-display text-lg uppercase leading-tight text-on-surface">
              {GAME_PLAN_LABELS[plan]}
            </span>
            <span className="font-body text-xs text-on-surface-variant">
              {GAME_PLAN_BLURBS[plan]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
