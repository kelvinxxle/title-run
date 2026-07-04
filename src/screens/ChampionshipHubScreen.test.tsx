import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChampionshipHubScreen from './ChampionshipHubScreen';
import { startRun, applyDraft, generateOpponent, STAT_IDS, type RunState, type StatLine } from '../domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
const noop = () => {};

describe('ChampionshipHubScreen (v2)', () => {
  it('null run shows title + start button + no-title reign line', () => {
    render(<ChampionshipHubScreen run={null} onStartRun={noop} onEnterFight={noop} />);
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
    expect(screen.getByTestId('best-reign')).toHaveTextContent('No title yet');
  });

  it('pre-fight shows the next opponent + Enter the Octagon', () => {
    const run = applyDraft(startRun('seedH'), { name: 'Ace', statLine: LINE });
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} />);
    expect(screen.getByTestId('player-name')).toHaveTextContent('Ace');
    expect(screen.getByTestId('next-opponent')).toBeInTheDocument();
    expect(screen.getByTestId('enter-fight')).toHaveTextContent(/Enter the Octagon/i);
  });

  it('pre-fight shows two fighter avatars for player and opponent', () => {
    const run = applyDraft(startRun('seedH'), { name: 'Ace', statLine: LINE });
    const opponent = generateOpponent(run.seed, run.fightNumber);
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} />);
    const avatars = screen.getAllByTestId('fighter-avatar');
    expect(avatars).toHaveLength(2);
    expect(screen.getByLabelText('Ace portrait', { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText(`${opponent.name} portrait`, { exact: true })).toBeInTheDocument();
  });

  it('run-over shows record + reign + new-record flourish', () => {
    const run: RunState = { seed:'x', phase:'run-over', fighter:{name:'Ace',statLine:LINE}, fightNumber:6, record:{wins:5,losses:1}, isChampion:true, defenses:1, fight:null };
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} bestReign={0} isNewRecord />);
    expect(screen.getByText('Record 5–1')).toBeInTheDocument();
    expect(screen.getByTestId('new-record')).toBeInTheDocument();
  });

  it('seeds opponent avatars by opponent name so same-named opponents have identical avatars', () => {
    const o4 = generateOpponent('209', 4);
    const o7 = generateOpponent('209', 7);
    expect(o4.name).toBe(o7.name);
    expect(o4.archetype).toBe(o7.archetype);

    const mk = (fightNumber: number): RunState => ({
      seed: '209', phase: 'pre-fight', fighter: { name: 'Ace', statLine: LINE },
      fightNumber, record: { wins: fightNumber - 1, losses: 0 }, isChampion: false, defenses: 0, fight: null,
    });

    const r4 = render(<ChampionshipHubScreen run={mk(4)} onStartRun={noop} onEnterFight={noop} />);
    const opp4 = within(r4.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-avatar').outerHTML;
    r4.unmount();
    const r7 = render(<ChampionshipHubScreen run={mk(7)} onStartRun={noop} onEnterFight={noop} />);
    const opp7 = within(r7.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-avatar').outerHTML;
    expect(opp4).toBe(opp7);
  });

  it('seeds opponent avatars by opponent name so different names produce different avatars', () => {
    const o1 = generateOpponent('999', 1);
    const o2 = generateOpponent('888', 1);
    expect(o1.name).not.toBe(o2.name);

    const mk = (seed: string, fightNumber: number): RunState => ({
      seed, phase: 'pre-fight', fighter: { name: 'Ace', statLine: LINE },
      fightNumber, record: { wins: fightNumber - 1, losses: 0 }, isChampion: false, defenses: 0, fight: null,
    });

    const r1 = render(<ChampionshipHubScreen run={mk('999', 1)} onStartRun={noop} onEnterFight={noop} />);
    const opp1 = within(r1.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-avatar').outerHTML;
    r1.unmount();
    const r2 = render(<ChampionshipHubScreen run={mk('888', 1)} onStartRun={noop} onEnterFight={noop} />);
    const opp2 = within(r2.container.querySelector('[data-testid="next-opponent"]') as HTMLElement).getByTestId('fighter-avatar').outerHTML;
    expect(opp1).not.toBe(opp2);
  });
});
