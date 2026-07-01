import {
  generateOpponent, STAT_IDS, STAT_LABELS, TITLE_FIGHT, durability,
  type RunState,
} from '../domain';
import FighterHealthCard from '../components/FighterHealthCard';
import StatBar from '../components/StatBar';
import OutcomeBanner from '../components/OutcomeBanner';

export interface HubProps {
  run: RunState | null;
  onStartRun: () => void;
  onEnterFight: () => void;
}

export default function ChampionshipHubScreen({ run, onStartRun, onEnterFight }: HubProps) {
  if (run === null) {
    return (
      <section data-testid="screen-championship-hub">
        <h1>Title Run</h1>
        <button data-testid="start-run" onClick={onStartRun}>Start New Run</button>
      </section>
    );
  }

  if (run.phase === 'run-over') {
    return (
      <section data-testid="screen-championship-hub">
        {run.fight?.outcome && <OutcomeBanner outcome={run.fight.outcome} heading="Run Ended" />}
        <p>Record {run.record.wins}–{run.record.losses}</p>
        {run.isChampion && <p>Reign {run.defenses}</p>}
        <button data-testid="start-run" onClick={onStartRun}>Start New Run</button>
      </section>
    );
  }

  // pre-fight
  const fighter = run.fighter;
  const isTitle = run.fightNumber === TITLE_FIGHT;
  const isChampion = run.isChampion;
  const opponent = generateOpponent(run.seed, run.fightNumber);

  return (
    <section data-testid="screen-championship-hub">
      {isChampion ? (
        <h2>Champion · Reign {run.defenses}</h2>
      ) : isTitle ? (
        <h2>For the Vacant Belt</h2>
      ) : (
        <h2>Fight {run.fightNumber}</h2>
      )}

      {fighter && (
        <>
          <FighterHealthCard
            side="player"
            name={fighter.name}
            subtitle="YOUR FIGHTER"
            badge="YOU"
            healthPct={1 - run.carriedDamage / durability(fighter.statLine)}
          />
          <div>
            {STAT_IDS.map((s) => (
              <StatBar key={s} value={fighter.statLine[s]} label={STAT_LABELS[s]} />
            ))}
          </div>
        </>
      )}

      <div data-testid="next-opponent">
        <p>{opponent.name}</p>
        <p>{opponent.style}</p>
      </div>

      <button data-testid="enter-fight" onClick={onEnterFight}>
        {isChampion ? 'Defend the Belt' : isTitle ? 'Fight for the Belt' : 'Enter the Octagon'}
      </button>
    </section>
  );
}
