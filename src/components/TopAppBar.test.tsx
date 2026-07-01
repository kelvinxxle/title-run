import { describe, it, expect } from 'vitest';
import { runStatusLabel } from './TopAppBar';
import { startRun, applyDraft, type RunState } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
const base = (o: Partial<RunState> = {}): RunState => ({ ...applyDraft(startRun('run-42'), { name: 'K', statLine: PLAYER }), ...o });

describe('runStatusLabel', () => {
  it('is empty with no run', () => { expect(runStatusLabel(null)).toBe(''); });
  it('reads Drafting during the draft', () => { expect(runStatusLabel(base({ phase: 'drafting' }))).toBe('Drafting'); });
  it('reads Run Ended after a loss', () => { expect(runStatusLabel(base({ phase: 'run-over' }))).toBe('Run Ended'); });
  it('shows the challenger record while climbing', () => {
    expect(runStatusLabel(base({ phase: 'pre-fight', fightNumber: 2, record: { wins: 1, losses: 0 } })))
      .toBe('Fight 2 · 1–0 · Challenger');
  });
  it('shows the reign as champion', () => {
    expect(runStatusLabel(base({ phase: 'pre-fight', fightNumber: 6, isChampion: true, defenses: 3 })))
      .toBe('★ Champion · Reign 3');
  });
});
