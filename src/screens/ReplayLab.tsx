import { useState } from 'react';
import FightReplay from '../replay/FightReplay';
import { startFight, resolveExchange, signatureReady } from '../domain/combat';
import type { FightState } from '../domain/combat';
import type { ResolvedBeat } from '../domain/combat/beat';

const LAB_SEED = 'mcgregor-lab-001';

function buildLabClip(): ResolvedBeat[] {
  const playerStatLine = { striking:85, strikingDef:75, takedowns:40, takedownDef:80, submissions:40, submissionDef:70, cardio:80, chin:75, fightIQ:80 };
  const opponent = { id: 'lab-opp', name: 'Lab Opponent', archetype: 'striker', statLine: { striking:55, strikingDef:55, takedowns:40, takedownDef:55, submissions:40, submissionDef:55, cardio:60, chin:60, fightIQ:55 } };
  let s = startFight({ seed: LAB_SEED, fightNumber: 1, playerStatLine, signatureId: 'the-left-hand', opponent });
  const kick = { kind: 'strike' as const, strike: 'legKick' as const };
  for (let i = 0; i < 20; i++) {
    if (s.phase === 'finished') break;
    if (s.phase === 'corner') s = { ...s, phase: 'in-round', gamePlan: null } as FightState;
    if (s.phase === 'finish-window') break;
    if (s.phase !== 'in-round') break;
    if (signatureReady(s)) {
      s = resolveExchange(s, { kind: 'signature' });
      break;
    }
    s = resolveExchange(s, kick);
  }
  return s.beats;
}

export default function ReplayLab() {
  const [labBeats] = useState<ResolvedBeat[]>(() => buildLabClip());
  const [idx, setIdx] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const beat = labBeats[idx] ?? null;

  return (
    <div data-testid="replay-lab" className="p-4 flex flex-col items-center gap-4 bg-background min-h-screen">
      <h1 className="font-display text-2xl text-on-surface">Replay Lab</h1>
      <p className="text-sm text-on-surface-variant">Beat {idx + 1} / {labBeats.length}</p>
      {beat && (
        <pre className="text-xs text-on-surface-variant bg-surface p-2 rounded max-w-lg overflow-auto">
          {JSON.stringify({ moveClass: beat.moveClass, moveId: beat.moveId, outcome: beat.outcome, signatureId: beat.signatureId, isFinish: beat.isFinish }, null, 2)}
        </pre>
      )}
      <FightReplay
        key={replayKey}
        beat={beat}
        playerName="Conor McGregor"
        playerArchetype="striker"
        opponentName="Lab Opponent"
        opponentArchetype="striker"
        presentationSeed={LAB_SEED + '#' + idx}
      />
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="replay-prev"
          disabled={idx === 0}
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          className="px-4 py-2 bg-surface text-on-surface rounded disabled:opacity-50"
        >Prev</button>
        <button
          type="button"
          data-testid="replay-replay"
          onClick={() => setReplayKey(k => k + 1)}
          className="px-4 py-2 bg-primary text-on-primary rounded"
        >Replay</button>
        <button
          type="button"
          data-testid="replay-next"
          disabled={idx >= labBeats.length - 1}
          onClick={() => setIdx(i => Math.min(labBeats.length - 1, i + 1))}
          className="px-4 py-2 bg-surface text-on-surface rounded disabled:opacity-50"
        >Next</button>
      </div>
    </div>
  );
}
