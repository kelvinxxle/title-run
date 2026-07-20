import { getFighter } from './roster';
import type { ArchetypeId } from './archetypes';

// ── M17 Signature Strike Moves ────────────────────────────────────────────────
// NOTE: Fighter.signature in roster.ts is a Partial<StatLine> (stat weights).
// SignatureMove here is a distinct concept — a high-impact strike profile.
// Use SignatureMove / signatureId / SIGNATURE_MOVES to avoid collision.

export interface SignatureMove {
  id: string;
  label: string;
  blurb: string;
  /** Dramatic detonation flavor line for the RoundReport headline. */
  flavor: string;
  /** Offensive multiplier — must exceed powerPunch (1.35) to be impactful. */
  atkMult: number;
  /** Defensive exposure while throwing (same semantics as StrikeProfile.defMult for strike counters;
   *  ignored for takedown counters — defMult always returns 1.0 for 'wrestle' phase). */
  defMult: number;
  /** Damage weight applied to |dominance| when it lands. */
  power: number;
  // NOTE: speed and koWeight intentionally absent:
  //   • Signatures are timing-immune (timingBonus only reads STRIKES, never signature profiles).
  //   • KO detection uses accumulated head damage, not koWeight (detectWindow ignores signature kind).
}

// ── Archetype generics (guaranteed coverage for every roster fighter) ─────────
export const ARCHETYPE_SIGNATURE: Record<ArchetypeId, SignatureMove> = {
  striker: {
    id: 'check-hook',
    label: 'Check Hook',
    blurb: 'Step left, pivot, land the check hook as he rushes in.',
    flavor: 'PERFECT — the check hook lands and the lights go out!',
    atkMult: 1.55,
    defMult: 0.90,
    power: 1.40,
  },
  brawler: {
    id: 'overhand-bomb',
    label: 'Overhand Bomb',
    blurb: 'Load up, loop it over the top with everything you have.',
    flavor: 'He loads up — OVERHAND BOMB — lights out!',
    atkMult: 1.60,
    defMult: 0.65,
    power: 1.55,
  },
  wrestler: {
    id: 'level-change-right',
    label: 'Level-Change Right',
    blurb: 'Fake the takedown, stand back up, right hand over the top.',
    flavor: 'Level change to right hand — BOOMING shot!',
    atkMult: 1.50,
    defMult: 0.75,
    power: 1.45,
  },
  grappler: {
    id: 'flying-knee',
    label: 'Flying Knee',
    blurb: 'Explode off the cage, drive the knee straight to the chin.',
    flavor: 'FLYING KNEE — that could end the night!',
    atkMult: 1.55,
    defMult: 0.70,
    power: 1.50,
  },
  allrounder: {
    id: 'spinning-back-kick',
    label: 'Spinning Back Kick',
    blurb: 'Spin into a loaded back kick — pure technique, brutal power.',
    flavor: 'Spinning back kick — PERFECTLY placed! What a shot!',
    atkMult: 1.52,
    defMult: 0.75,
    power: 1.45,
  },
};

// ── Curated marquee overrides (additive flavor; ~8 entries) ──────────────────
export const MARQUEE_SIGNATURE: Record<string, SignatureMove> = {
  'conor-mcgregor': {
    id: 'the-left-hand',
    label: 'The Left Hand',
    blurb: "Step into the pocket, plant the feet, and detonate that left hand.",
    flavor: "THAT LEFT HAND — you can't teach that timing!",
    atkMult: 1.60,
    defMult: 0.72,
    power: 1.55,
  },
  'jon-jones': {
    id: 'spinning-elbow',
    label: 'Spinning Elbow',
    blurb: "Spin off the cage wall and deliver the spinning elbow at full torque.",
    flavor: "SPINNING ELBOW from Jones — absolutely devastating!",
    atkMult: 1.58,
    defMult: 0.75,
    power: 1.50,
  },
  'anderson-silva': {
    id: 'front-kick',
    label: 'Front Kick',
    blurb: "Plant the back foot, load the hip, drive the front kick to the chin.",
    flavor: "FRONT KICK to the chin — just like the Spider imagined it!",
    atkMult: 1.55,
    defMult: 0.80,
    power: 1.45,
  },
  'jose-aldo': {
    id: 'body-kick-counter',
    label: 'Body-Kick Counter',
    blurb: "Step back, time the lead, and counter with a loaded body kick.",
    flavor: "BODY KICK COUNTER — Aldo lands flush on the liver!",
    atkMult: 1.52,
    defMult: 0.85,
    power: 1.50,
  },
  'max-holloway': {
    id: 'volume-finisher',
    label: 'Volume Finisher',
    blurb: "Walk him down and unload a blinding combination — no backup available.",
    flavor: "BLESSED! The volume finisher drops him!",
    atkMult: 1.55,
    defMult: 0.80,
    power: 1.45,
  },
  'francis-ngannou': {
    id: 'predator-bomb',
    label: 'Predator Bomb',
    blurb: "One shot. Pure power. Nothing more is needed.",
    flavor: "THE PREDATOR LANDS — lights out with one punch!",
    atkMult: 1.70,
    defMult: 0.60,
    power: 1.70,
  },
  'israel-adesanya': {
    id: 'last-stylebender',
    label: 'Last Stylebender',
    blurb: "Read the rhythm, slip outside, counter with the straight right.",
    flavor: "THE LAST STYLEBENDER — perfect counter!",
    atkMult: 1.55,
    defMult: 0.90,
    power: 1.45,
  },
  'georges-st-pierre': {
    id: 'superman-punch',
    label: 'Superman Punch',
    blurb: "Feint the kick, spring off the back foot, and drive the right hand in flight.",
    flavor: "SUPERMAN PUNCH — GSP lands it perfectly!",
    atkMult: 1.55,
    defMult: 0.78,
    power: 1.48,
  },
};

// ── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve a SignatureMove for a given source fighter id.
 * Checks MARQUEE_SIGNATURE first; falls back to ARCHETYPE_SIGNATURE.
 * Pure, deterministic, total (throws for truly unknown ids).
 */
export function resolveSignature(sourceFighterId: string): SignatureMove {
  const marquee = MARQUEE_SIGNATURE[sourceFighterId];
  if (marquee) return marquee;
  // getFighter throws for unknown ids — gives us the guarantee of totality.
  const fighter = getFighter(sourceFighterId);
  return ARCHETYPE_SIGNATURE[fighter.archetype];
}

/** Build a lookup map from move id → SignatureMove (for detonation in resolveExchange). */
const _moveById: ReadonlyMap<string, SignatureMove> = new Map<string, SignatureMove>([
  ...Object.values(ARCHETYPE_SIGNATURE).map((m): [string, SignatureMove] => [m.id, m]),
  ...Object.values(MARQUEE_SIGNATURE).map((m): [string, SignatureMove] => [m.id, m]),
]);

/**
 * Look up a SignatureMove by its move id.
 * Used during signature detonation where state.signatureId is the move id.
 */
export function getSignatureMoveById(id: string): SignatureMove {
  const move = _moveById.get(id);
  if (!move) throw new Error(`Unknown signature move id: ${id}`);
  return move;
}
