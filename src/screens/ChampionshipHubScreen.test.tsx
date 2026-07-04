import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('img', { name: /Ace portrait/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: new RegExp(`${opponent.name} portrait`, 'i') })).toBeInTheDocument();
  });

  it('run-over shows record + reign + new-record flourish', () => {
    const run: RunState = { seed:'x', phase:'run-over', fighter:{name:'Ace',statLine:LINE}, fightNumber:6, record:{wins:5,losses:1}, isChampion:true, defenses:1, fight:null };
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} bestReign={0} isNewRecord />);
    expect(screen.getByText('Record 5–1')).toBeInTheDocument();
    expect(screen.getByTestId('new-record')).toBeInTheDocument();
  });
});
