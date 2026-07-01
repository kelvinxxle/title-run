import type { RunState } from '../domain';

export function runStatusLabel(run: RunState | null): string {
  if (!run) return '';
  if (run.phase === 'drafting') return 'Drafting';
  if (run.phase === 'run-over') return 'Run Ended';
  if (run.isChampion) return `★ Champion · Reign ${run.defenses}`;
  return `Fight ${run.fightNumber} · ${run.record.wins}–${run.record.losses} · Challenger`;
}

export interface TopAppBarProps { run: RunState | null }

export default function TopAppBar({ run }: TopAppBarProps) {
  return (
    <header
      role="banner"
      className="bg-surface border-b-2 border-outline-variant px-md py-sm"
    >
      <span className="font-display text-primary text-2xl uppercase tracking-widest">
        Title Run
      </span>
      <span data-testid="run-status">{runStatusLabel(run)}</span>
    </header>
  );
}
