import {
  generateOpponent, archetypeFromStatLine, STAT_IDS, STAT_LABELS, TITLE_FIGHT,
  type RunState,
} from '../domain/combat';
import StatBar from '../components/StatBar';
import OutcomeBanner from '../components/OutcomeBanner';
import FighterImage from '../components/FighterImage';

export interface HubProps {
  run: RunState | null;
  onStartRun: () => void;
  onEnterFight: () => void;
  bestReign?: number | null;
  isNewRecord?: boolean;
}

export default function ChampionshipHubScreen({ run, onStartRun, onEnterFight, bestReign = null, isNewRecord = false }: HubProps) {
  const bestReignLine = (
    <p data-testid="best-reign">{bestReign === null ? 'No title yet' : `Best reign: ${bestReign}`}</p>
  );

  if (run === null) {
    return (
      <section data-testid="screen-championship-hub" className="p-md flex flex-col items-center gap-sm">
        <h1 className="font-display text-4xl uppercase text-primary">Title Run</h1>
        {bestReignLine}
        <button data-testid="start-run" onClick={onStartRun} className="bg-primary text-on-primary font-display text-xl uppercase px-lg py-sm">Start New Run</button>
      </section>
    );
  }

  if (run.phase === 'run-over') {
    return (
      <section data-testid="screen-championship-hub" className="p-md flex flex-col items-center gap-sm">
        {run.fight?.outcome && <OutcomeBanner outcome={run.fight.outcome} heading="Run Ended" />}
        {isNewRecord && <p data-testid="new-record">★ New best reign!</p>}
        <p>Record {run.record.wins}–{run.record.losses}</p>
        <p>Reign {run.defenses}</p>
        {bestReignLine}
        <button data-testid="start-run" onClick={onStartRun} className="bg-primary text-on-primary font-display text-xl uppercase px-lg py-sm">Start New Run</button>
      </section>
    );
  }

  // pre-fight
  const fighter = run.fighter;
  const isTitle = run.fightNumber === TITLE_FIGHT;
  const isChampion = run.isChampion;
  const opponent = generateOpponent(run.seed, run.fightNumber);

  return (
    <section data-testid="screen-championship-hub" className="p-md flex flex-col items-center gap-md">
      {isChampion ? (
        <h2 className="font-display text-3xl uppercase text-primary">Champion · Reign {run.defenses}</h2>
      ) : isTitle ? (
        <h2 className="font-display text-3xl uppercase text-primary">For the Vacant Belt</h2>
      ) : (
        <h2 className="font-display text-3xl uppercase text-on-surface">Fight {run.fightNumber}</h2>
      )}

      {fighter && (
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-sm">
            <FighterImage name={fighter.name} archetype={archetypeFromStatLine(fighter.statLine)} seed={fighter.name} />
            <p data-testid="player-name" className="font-display text-2xl uppercase text-on-surface">{fighter.name}</p>
          </div>
          <div className="flex flex-col gap-xs mt-sm">
            {STAT_IDS.map((s) => (<StatBar key={s} value={fighter.statLine[s]} label={STAT_LABELS[s]} />))}
          </div>
        </div>
      )}

      <div data-testid="next-opponent" className="w-full max-w-lg bg-surface-container border border-outline p-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">Next opponent</p>
        <div className="flex items-center gap-sm">
          <FighterImage fighterId={opponent.id} name={opponent.name} archetype={opponent.archetype} seed={opponent.name} />
          <p className="font-display text-xl uppercase text-secondary">{opponent.name}</p>
        </div>
        <p className="font-mono text-xs uppercase text-on-surface-variant">{opponent.archetype}</p>
      </div>

      <button data-testid="enter-fight" onClick={onEnterFight} className="w-full max-w-lg h-16 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide">
        {isChampion ? 'Defend the Belt' : isTitle ? 'Fight for the Belt' : 'Enter the Octagon'}
      </button>
    </section>
  );
}
