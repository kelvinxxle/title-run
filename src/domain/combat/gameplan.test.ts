import { describe, it, expect } from 'vitest';
import { gamePlanEffect, GAME_PLAN_EFFECTS } from './gameplan';
import { gamePlanEffect as gamePlanEffectFromBarrel } from './index';
import { GAME_PLANS, GAME_PLAN_LABELS, GAME_PLAN_BLURBS } from './intents';

describe('game-plan effects', () => {
  it('GAME_PLANS has 4 plans', () => {
    expect(GAME_PLANS).toHaveLength(4);
    expect(GAME_PLANS).toContain('push-pace');
    expect(GAME_PLANS).toContain('work-body');
    expect(GAME_PLANS).toContain('stay-disciplined');
    expect(GAME_PLANS).toContain('catch-breath');
  });

  it('labels and blurbs cover every plan', () => {
    for (const p of GAME_PLANS) {
      expect(GAME_PLAN_LABELS[p]).toBeTruthy();
      expect(GAME_PLAN_BLURBS[p]).toBeTruthy();
    }
  });

  it('push-pace raises attack', () => {
    expect(GAME_PLAN_EFFECTS['push-pace'].atkMult).toBeGreaterThan(1);
  });

  it('stay-disciplined raises defense', () => {
    expect(GAME_PLAN_EFFECTS['stay-disciplined'].defMult).toBeGreaterThan(1);
  });

  it('catch-breath gives positive stamina delta', () => {
    expect(GAME_PLAN_EFFECTS['catch-breath'].staminaDelta).toBeGreaterThan(0);
  });

  it('work-body forces body target', () => {
    expect(GAME_PLAN_EFFECTS['work-body'].forceBodyTarget).toBe(true);
  });

  it('null plan returns identity', () => {
    const eff = gamePlanEffect(null);
    expect(eff.atkMult).toBe(1.0);
    expect(eff.defMult).toBe(1.0);
    expect(eff.staminaDelta).toBe(0);
    expect(eff.forceBodyTarget).toBe(false);
  });

  it('each plan maps to its defined effect', () => {
    for (const p of GAME_PLANS) {
      expect(gamePlanEffect(p)).toEqual(GAME_PLAN_EFFECTS[p]);
    }
  });

  it('exports game-plan helpers from the combat barrel', () => {
    expect(gamePlanEffectFromBarrel).toBe(gamePlanEffect);
  });
});
