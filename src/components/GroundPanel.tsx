import { GROUND_PLANS, GROUND_PLAN_LABELS, type GroundPlan, type FinishWindow } from '../domain/combat';

interface Props { window: FinishWindow; onGround: (plan: GroundPlan) => void; disabled?: boolean; }

const PLAN_TESTID: Record<GroundPlan, string> = {
  'ground-and-pound': 'ground-gnp',
  submission: 'ground-sub',
};

export default function GroundPanel({ window: win, onGround, disabled = false }: Props) {
  return (
    <div
      data-testid="ground-panel"
      data-side={win.side}
      className="w-full p-md flex flex-col gap-sm border-2 border-primary"
    >
      <h3 className="font-display text-2xl uppercase tracking-wide text-primary">TOP CONTROL</h3>
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
        You've secured top control — pick your finish.
      </p>
      <div className="grid grid-cols-2 gap-xs">
        {GROUND_PLANS.map((plan) => (
          <button
            key={plan}
            type="button"
            data-testid={PLAN_TESTID[plan]}
            disabled={disabled}
            onClick={() => onGround(plan)}
            className="py-md font-display text-lg uppercase bg-surface-container border border-outline disabled:opacity-50"
          >
            {GROUND_PLAN_LABELS[plan]}
          </button>
        ))}
      </div>
    </div>
  );
}
