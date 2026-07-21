export type BeatActor = 'player' | 'opponent';
export type BeatMoveClass =
  | 'advance' | 'strike' | 'evade' | 'counter' | 'impact' | 'knockdown' | 'signature' | 'takedown' | 'ground';
export type BeatOutcome = 'landed' | 'evaded' | 'blocked' | 'countered';
export type BeatTarget = 'head' | 'body' | 'legs' | null;

export interface BeatDeltas {
  playerHead: number; playerBody: number; playerLeg: number; playerStamina: number;
  opponentHead: number; opponentBody: number; opponentLeg: number; opponentStamina: number;
}
export interface BeatStatus {
  playerBecameRocked: boolean; opponentBecameRocked: boolean;
  playerGassed: boolean; opponentGassed: boolean;
}
export interface ResolvedBeat {
  id: string;              // `${round}-${exchange}` — stable, deterministic key
  round: number;
  exchange: number;
  actorId: BeatActor;      // decisive winner of the beat (draw → 'player' by convention, outcome 'evaded')
  targetId: BeatActor;     // the other fighter
  moveClass: BeatMoveClass;
  moveId: string | null;   // StrikeId | signatureId | TakedownType | null
  outcome: BeatOutcome;
  target: BeatTarget;
  deltas: BeatDeltas;
  status: BeatStatus;
  signatureId: string | null; // set when the player's decisive move was a signature detonation
  isFinish: boolean;
  finishMethod: 'KO' | 'submission' | null;
}

export interface BuildBeatArgs {
  round: number; exchange: number;
  winner: 'player' | 'opponent' | 'draw';
  dominance: number;
  moveClass: BeatMoveClass;
  moveId: string | null;
  target: BeatTarget;
  deltas: BeatDeltas;
  status: BeatStatus;
  signatureId: string | null;
  isFinish: boolean;
  finishMethod: 'KO' | 'submission' | null;
}

const DRAW_EPS = 6;
export function buildResolvedBeat(a: BuildBeatArgs): ResolvedBeat {
  const actorId: BeatActor = a.winner === 'opponent' ? 'opponent' : 'player';
  const targetId: BeatActor = actorId === 'player' ? 'opponent' : 'player';
  const dmgToTarget = targetId === 'opponent'
    ? a.deltas.opponentHead + a.deltas.opponentBody + a.deltas.opponentLeg
    : a.deltas.playerHead + a.deltas.playerBody + a.deltas.playerLeg;
  let outcome: BeatOutcome;
  if (a.isFinish) outcome = 'landed';
  else if (a.signatureId != null && a.winner === 'player') outcome = 'countered';
  else if (a.winner === 'draw' || Math.abs(a.dominance) < DRAW_EPS) outcome = 'evaded';
  else outcome = dmgToTarget > 0 ? 'landed' : 'blocked';
  return { id: `${a.round}-${a.exchange}`, round: a.round, exchange: a.exchange,
    actorId, targetId, moveClass: a.moveClass, moveId: a.moveId, outcome, target: a.target,
    deltas: a.deltas, status: a.status, signatureId: a.signatureId,
    isFinish: a.isFinish, finishMethod: a.finishMethod };
}
