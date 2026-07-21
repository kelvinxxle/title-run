import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChampionshipHubScreen from './ChampionshipHubScreen';
import { startRun, applyDraft, generateOpponent, STAT_IDS, type RunState, type StatLine, type SlotFill, type StatId } from '../domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
const MOCK_SLOTS = Object.fromEntries(STAT_IDS.map((s) => [s, { value: 55, sourceFighterId: 'israel-adesanya' }])) as Record<StatId, SlotFill>;
const noop = () => {};

describe('ChampionshipHubScreen (v2)', () => {
  it('null run shows title + start button + no-title reign line', () => {
    render(<ChampionshipHubScreen run={null} onStartRun={noop} onEnterFight={noop} />);
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
    expect(screen.getByTestId('best-reign')).toHaveTextContent('No title yet');
  });

  it('pre-fight shows the next opponent + Enter the Octagon', () => {
    const run = applyDraft(startRun('seedH'), { name: 'Ace', statLine: LINE, slots: MOCK_SLOTS });
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} />);
    expect(screen.getByTestId('player-name')).toHaveTextContent('Ace');
    expect(screen.getByTestId('next-opponent')).toBeInTheDocument();
    expect(screen.getByTestId('enter-fight')).toHaveTextContent(/Enter the Octagon/i);
  });

  it('pre-fight shows opponent photo and player avatar fallback', () => {
    const run = applyDraft(startRun('seedH'), { name: 'Ace', statLine: LINE, slots: MOCK_SLOTS });
    const opponent = generateOpponent(run.seed, run.fightNumber);
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} />);
    // player (no roster id) → avatar fallback
    expect(screen.getByLabelText('Ace portrait', { exact: true })).toBeInTheDocument();
    // opponent (roster fighter with id) → real photo
    const oppImg = within(screen.getByTestId('next-opponent')).getByTestId('fighter-photo') as HTMLImageElement;
    expect(oppImg.getAttribute('src')).toMatch(new RegExp(`fighters/${opponent.id}\\.jpg$`));
    expect(oppImg).toHaveAttribute('alt', opponent.name);
  });

  it('run-over shows record + reign + new-record flourish', () => {
    const run: RunState = { seed:'x', phase:'run-over', fighter:{name:'Ace',statLine:LINE,signatureId:'check-hook'}, fightNumber:6, record:{wins:5,losses:1}, isChampion:true, defenses:1, fight:null };
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} bestReign={0} isNewRecord />);
    expect(screen.getByText('Record 5–1')).toBeInTheDocument();
    expect(screen.getByTestId('new-record')).toBeInTheDocument();
  });

  it('seeds opponent portraits by opponent id so same-named opponents have identical photo src', () => {
    // seeds 's0' and 's4' both pick the same Tier-5 fighter at fight 5 (verified deterministic)
    const o5a = generateOpponent('s0', 5);
    const o5b = generateOpponent('s4', 5);
    expect(o5a.name).toBe(o5b.name);
    expect(o5a.id).toBe(o5b.id);

    const mk = (seed: string, fightNumber: number): RunState => ({
      seed, phase: 'pre-fight', fighter: { name: 'Ace', statLine: LINE, signatureId: 'check-hook' },
      fightNumber, record: { wins: fightNumber - 1, losses: 0 }, isChampion: false, defenses: 0, fight: null,
    });

    const r5a = render(<ChampionshipHubScreen run={mk('s0', 5)} onStartRun={noop} onEnterFight={noop} />);
    const oppA = (within(r5a.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-photo') as HTMLImageElement).getAttribute('src');
    r5a.unmount();
    const r5b = render(<ChampionshipHubScreen run={mk('s4', 5)} onStartRun={noop} onEnterFight={noop} />);
    const oppB = (within(r5b.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-photo') as HTMLImageElement).getAttribute('src');
    expect(oppA).toBe(oppB);
  });

  it('seeds opponent portraits by opponent id so different opponents have different photo src', () => {
    const o1 = generateOpponent('999', 1);
    const o2 = generateOpponent('888', 1);
    expect(o1.name).not.toBe(o2.name);
    expect(o1.id).not.toBe(o2.id);

    const mk = (seed: string, fightNumber: number): RunState => ({
      seed, phase: 'pre-fight', fighter: { name: 'Ace', statLine: LINE, signatureId: 'check-hook' },
      fightNumber, record: { wins: fightNumber - 1, losses: 0 }, isChampion: false, defenses: 0, fight: null,
    });

    const r1 = render(<ChampionshipHubScreen run={mk('999', 1)} onStartRun={noop} onEnterFight={noop} />);
    const opp1 = (within(r1.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-photo') as HTMLImageElement).getAttribute('src');
    r1.unmount();
    const r2 = render(<ChampionshipHubScreen run={mk('888', 1)} onStartRun={noop} onEnterFight={noop} />);
    const opp2 = (within(r2.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-photo') as HTMLImageElement).getAttribute('src');
    expect(opp1).not.toBe(opp2);
  });
});
