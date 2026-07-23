/**
 * ArenaDemo — dev-only feel-gate v2 capture harness.
 * Mount via ?arena=demo in App.tsx. NOT part of the normal game flow.
 * Drives the REAL FightView with a fixed-seed scripted fight so captures
 * reflect production UI exactly. No Math.random / Date.now / setInterval.
 */

import { useState } from 'react';
import { startFight, resolveExchange, finishStep, chooseGamePlan } from '../domain/combat';
import type { FightState, ExchangeMove, FinishChoice, GroundAction, GamePlan } from '../domain/combat';
import FightView from './FightView';

const DEMO_SEED = 'arena-demo-seed-v2';

/** McGregor as player (high striker, photo head in roster). */
const PLAYER_STATS = {
  striking: 94, strikingDef: 74, takedowns: 50, takedownDef: 60,
  submissions: 46, submissionDef: 54, cardio: 56, chin: 60, fightIQ: 82,
};

/** Two differently-framed roster opponents for ?who=jones / default. */
const OPPONENT_JONES = {
  id: 'jon-jones', name: 'Jon Jones', archetype: 'allrounder' as const,
  statLine: { striking: 90, strikingDef: 88, takedowns: 86, takedownDef: 88, submissions: 76, submissionDef: 80, cardio: 84, chin: 82, fightIQ: 94 },
};
const OPPONENT_ADESANYA = {
  id: 'israel-adesanya', name: 'Israel Adesanya', archetype: 'striker' as const,
  statLine: { striking: 92, strikingDef: 86, takedowns: 48, takedownDef: 60, submissions: 44, submissionDef: 58, cardio: 72, chin: 68, fightIQ: 84 },
};

function makeDemo(who: string): { fight: FightState; playerName: string } {
  const opponent = who === 'adesanya' ? OPPONENT_ADESANYA : OPPONENT_JONES;
  const playerName = who === 'custom' ? 'You (Custom)' : 'Conor McGregor';
  const fight = startFight({
    seed: DEMO_SEED,
    fightNumber: 1,
    playerStatLine: PLAYER_STATS,
    opponent,
  });
  return { fight, playerName };
}

export default function ArenaDemo() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const who = params.get('who') ?? 'jones';

  const [{ fight, playerName }] = useState(() => makeDemo(who));
  const [fightState, setFight] = useState<FightState>(fight);

  const handleMove = (move: ExchangeMove) =>
    setFight((f) => {
      if (f.phase !== 'in-round') return f;
      return resolveExchange(f, move);
    });

  const handleFinishStep = (choice: FinishChoice) =>
    setFight((f) => {
      if (f.phase !== 'finish-window') return f;
      return finishStep(f, choice);
    });

  const handleGroundAction = (_action: GroundAction) => {
    // ground → mat overlay in ArenaStage — no-op in demo (can't reach without takedown move)
  };

  const handleChooseGamePlan = (plan: GamePlan) =>
    setFight((f) => {
      if (f.phase !== 'corner') return f;
      return chooseGamePlan(f, plan);
    });

  const handleContinue = () => {
    // Reset to a fresh demo fight when finished
    setFight(makeDemo(who).fight);
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#0e0e0e' }}>
      <div style={{ padding: '4px 8px', fontFamily: 'Space Mono, monospace', fontSize: 10,
                    color: '#99907c', borderBottom: '1px solid #201f1f' }}>
        ARENA DEMO — feel-gate v2 — ?who=jones|adesanya|custom
      </div>
      <FightView
        fightState={fightState}
        playerName={playerName}
        onMove={handleMove}
        onFinishStep={handleFinishStep}
        onGroundAction={handleGroundAction}
        onChooseGamePlan={handleChooseGamePlan}
        onContinue={handleContinue}
      />
    </div>
  );
}
