import type { GamePlan } from './intents';

export interface GamePlanEffect {
  atkMult: number;
  defMult: number;
  staminaDelta: number;
  forceBodyTarget: boolean;
}

export const GAME_PLAN_EFFECTS: Record<GamePlan, GamePlanEffect> = {
  'push-pace': { atkMult: 1.15, defMult: 1.0, staminaDelta: -6, forceBodyTarget: false },
  'work-body': { atkMult: 1.0, defMult: 1.0, staminaDelta: 0, forceBodyTarget: true },
  'stay-disciplined': { atkMult: 1.0, defMult: 1.15, staminaDelta: 0, forceBodyTarget: false },
  'catch-breath': { atkMult: 0.85, defMult: 1.0, staminaDelta: +8, forceBodyTarget: false },
};

const IDENTITY: GamePlanEffect = { atkMult: 1.0, defMult: 1.0, staminaDelta: 0, forceBodyTarget: false };

/** Neutral (no plan) = identity {1,1,0,false} so round 1 with null plan reproduces pre-M14 resolveRound. */
export function gamePlanEffect(plan: GamePlan | null): GamePlanEffect {
  if (plan === null) return IDENTITY;
  return GAME_PLAN_EFFECTS[plan];
}
