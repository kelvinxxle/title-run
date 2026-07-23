import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FightView from './FightView';
import type { FightState } from '../domain/combat';
import { buildResolvedBeat } from '../domain/combat/beat';
import { headState, healthPct } from '../fightDisplay';

const base = (over: Partial<FightState> = {}): FightState => {
  const merged: FightState = {
    seed: 's', fightNumber: 1, rounds: 3, round: 1, exchange: 1, phase: 'in-round',
    player: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, legDamage: 0, roundScore:0 },
    opponent: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, legDamage: 0, roundScore:0, name:'Rival', archetype:'Boxer' },
    window: null, outcome: null, log: [], gamePlan: null, lastReport: null, ground: null, ...over,
  } as FightState;
  return { ...merged, gamePlan: merged.gamePlan ?? null, lastReport: merged.lastReport ?? null };
};

describe('FightView', () => {
  it('in-round: shows the strike panel and forwards a move via onMove', () => {
    const onMove = vi.fn();
    render(<FightView fightState={base()} playerName="Me" onMove={onMove} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('strike-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('intent-panel-v2')).toBeNull();
    fireEvent.click(screen.getByTestId('strike-jab'));
    expect(onMove).toHaveBeenCalledWith({ kind: 'strike', strike: 'jab' });
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-round', '1');
  });

  it('in-round: data-exchange reflects fightState.exchange', () => {
    render(<FightView fightState={base({ exchange: 2 })} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-exchange', '2');
  });

  it('finish-window: shows the finish panel and forwards a choice', () => {
    const onFinishStep = vi.fn();
    const st = base({ phase:'finish-window', window:{ side:'player', method:'KO', stepsLeft:3 } });
    render(<FightView fightState={st} playerName="Me" onMove={vi.fn()} onFinishStep={onFinishStep} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('finish-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('finish-commit'));
    expect(onFinishStep).toHaveBeenCalledWith('commit');
  });

  it('ground phase: shows the ground panel and forwards an action', () => {
    const onGroundAction = vi.fn();
    const st = base({ phase: 'ground', ground: { position: 'half-guard' }, window: null });
    render(<FightView fightState={st} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={onGroundAction} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('ground-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ground-sub'));
    expect(onGroundAction).toHaveBeenCalledWith('submission');
  });

  it('corner: shows the recap and forwards a game plan', () => {
    const onChooseGamePlan = vi.fn();
    const st = base({
      phase: 'corner',
      lastReport: {
        round: 1,
        headline: 'You took the round.',
        detail: 'You picked him apart at range.',
        winner: 'player',
        playerHeadDelta: 0,
        playerBodyDelta: 0,
        opponentHeadDelta: 6,
        opponentBodyDelta: 0,
      },
    });
    render(
      <FightView
        fightState={st}
        playerName="Me"
        onMove={vi.fn()}
        onFinishStep={vi.fn()}
        onGroundAction={vi.fn()}
        onChooseGamePlan={onChooseGamePlan}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByTestId('corner-screen')).toBeInTheDocument();
    expect(screen.getByTestId('round-recap')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('plan-push-pace'));
    expect(onChooseGamePlan).toHaveBeenCalledWith('push-pace');
  });

  it('finished: shows the outcome and Continue', () => {
    const onContinue = vi.fn();
    const st = base({ phase:'finished', outcome:{ winner:'player', method:'KO', round:2 } });
    render(<FightView fightState={st} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={onContinue} />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fight-continue'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('renders fighter-avatar for both player and opponent', () => {
    render(<FightView fightState={base()} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getAllByTestId('fighter-avatar')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Me portrait' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rival portrait' })).toBeInTheDocument();
  });

  it('seeds opponent avatars by opponent name so same opponent name produces same avatar', () => {
    const st1 = base({ fightNumber: 1, opponent: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, legDamage: 0, roundScore:0, name:'Rival', archetype:'Boxer' } });
    const st2 = base({ fightNumber: 5, opponent: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, legDamage: 0, roundScore:0, name:'Rival', archetype:'Boxer' } });

    const r1 = render(<FightView fightState={st1} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    const opp1Avatars = r1.container.querySelectorAll('[data-testid="fighter-avatar"]');
    const opp1SVG = opp1Avatars[1].outerHTML;
    r1.unmount();

    const r2 = render(<FightView fightState={st2} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    const opp2Avatars = r2.container.querySelectorAll('[data-testid="fighter-avatar"]');
    const opp2SVG = opp2Avatars[1].outerHTML;

    expect(opp1SVG).toBe(opp2SVG);
  });

  it('seeds opponent avatars by opponent name so different names produce different avatars', () => {
    const st1 = base({ opponent: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, legDamage: 0, roundScore:0, name:'Rival', archetype:'Boxer' } });
    const st2 = base({ opponent: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, legDamage: 0, roundScore:0, name:'Other', archetype:'Boxer' } });

    const r1 = render(<FightView fightState={st1} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    const opp1Avatars = r1.container.querySelectorAll('[data-testid="fighter-avatar"]');
    const opp1SVG = opp1Avatars[1].outerHTML;
    r1.unmount();

    const r2 = render(<FightView fightState={st2} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    const opp2Avatars = r2.container.querySelectorAll('[data-testid="fighter-avatar"]');
    const opp2SVG = opp2Avatars[1].outerHTML;

    expect(opp1SVG).not.toBe(opp2SVG);
  });

  // T8: control-lock tests
  const landedBeat = buildResolvedBeat({
    round: 1, exchange: 2, winner: 'player', dominance: 4,
    moveClass: 'strike', moveId: 'jab', outcome: 'landed', target: 'head',
    deltas: { playerHead:0, playerBody:0, playerLeg:0, playerStamina:2, opponentHead:12, opponentBody:0, opponentLeg:0, opponentStamina:1 },
    status: { playerBecameRocked:false, opponentBecameRocked:false, playerGassed:false, opponentGassed:false },
    signatureId: null, isFinish:false, finishMethod:null,
  });

  it('locks all panels while a beat is playing (2nd decision impossible mid-playback)', () => {
    const onMove = vi.fn();
    const st = base({ beats: [landedBeat] });
    render(<FightView fightState={st} playerName="Me" onMove={onMove} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.queryByTestId('strike-panel')).toBeNull();          // locked
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-round', '1'); // arena still mounted
  });

  it('unlocks immediately under prefers-reduced-motion', () => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...mql, matches: true } as MediaQueryList);
    const st = base({ beats: [landedBeat] });
    render(<FightView fightState={st} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('strike-panel')).toBeInTheDocument(); // reduced-motion → not playing → shown
    spy.mockRestore();
  });

  it('holds displayed HP until the punch lands (no early bar drop)', () => {
    const onMove = vi.fn();
    const pre = base();                                    // opponent full HP, settled
    const { rerender } = render(<FightView fightState={pre} playerName="Me" onMove={onMove} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    const post = base({ beats: [landedBeat], opponent: { ...pre.opponent, headDamage: 40 } });
    rerender(<FightView fightState={post} playerName="Me" onMove={onMove} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    // isPlaying true, t=0 (no flash yet) → opponent HP bar still shows the PRE value (held)
    const oppHealthMeter = within(screen.getByTestId('fighter-card-opponent')).getAllByRole('meter')[0];
    expect(oppHealthMeter.getAttribute('aria-valuenow')).toBe(String(Math.round(healthPct(pre.opponent) * 100)));
  });

  it('shows a real photo for a roster opponent and avatar fallback for the player', () => {
    // Jon Jones IS in the roster; 'Me' is a custom name NOT in the roster
    const fightState = base({
      opponent: {
        statLine: { striking:88, strikingDef:84, takedowns:86, takedownDef:88, submissions:76, submissionDef:80, cardio:84, chin:82, fightIQ:94 },
        headDamage:0, bodyDamage:0, stamina:100, legDamage: 0, roundScore:0,
        name: 'Jon Jones', archetype: 'allrounder',
      },
    });
    render(<FightView fightState={fightState} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    const oppImg = within(screen.getByTestId('fighter-card-opponent')).getByTestId('fighter-photo') as HTMLImageElement;
    expect(oppImg.getAttribute('src')).toMatch(/fighters\/jon-jones\.jpg$/);
    expect(oppImg).toHaveAttribute('alt', 'Jon Jones');
    // player corner stays a procedural avatar (no roster id)
    expect(within(screen.getByTestId('fighter-card-player')).queryByTestId('fighter-photo')).toBeNull();
    expect(within(screen.getByTestId('fighter-card-player')).getByLabelText(/portrait$/)).toBeInTheDocument();
  });

  // T11: HUD info parity — head-state + body/stamina meters survive arena insertion
  it('preserves HUD info parity (head-state + body/stamina meters retained)', () => {
    const st = base({ player: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage: 40, bodyDamage:0, stamina: 20, legDamage: 0, roundScore:0 } });
    render(<FightView fightState={st} playerName="Me" onMove={vi.fn()} onFinishStep={vi.fn()} onGroundAction={vi.fn()} onChooseGamePlan={vi.fn()} onContinue={vi.fn()} />);
    const card = screen.getByTestId('fighter-card-player');
    expect(card).toHaveAttribute('data-head-state', headState(st.player));
    expect(within(card).getAllByRole('meter').length).toBe(3);
  });
});
