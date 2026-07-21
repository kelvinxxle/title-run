import { startFight, resolveExchange } from './src/domain/combat/index.ts';

const P = { striking: 80, strikingDef: 70, takedowns: 40, takedownDef: 80, submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80 };
const O = { striking: 55, strikingDef: 55, takedowns: 45, takedownDef: 55, submissions: 45, submissionDef: 55, cardio: 60, chin: 60, fightIQ: 55 };

function playScript(seed, moves) {
  let s = startFight({ seed, fightNumber: 1, playerStatLine: P, opponent: { id: 'o', name: 'Foe', archetype: 'striker', statLine: O } });
  for (const m of moves) {
    if (s.phase === 'in-round') s = resolveExchange(s, m);
    else if (s.phase === 'corner') s = { ...s, phase: 'in-round', gamePlan: null };
  }
  return s;
}

const cross = { kind: 'strike', strike: 'cross' };
const jab = { kind: 'strike', strike: 'jab' };

const s = playScript('parity-seed', [cross, jab, cross]);
console.log('opponent.headDamage:', s.opponent.headDamage);
console.log('player.headDamage:', s.player.headDamage);
console.log('round:', s.round);
console.log('phase:', s.phase);
