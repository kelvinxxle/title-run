import type { PoseName } from './poses';

export interface RigPose {
  torso: number; head: number;
  armLead: number; foreLead: number;
  armRear: number; foreRear: number;
  thighLead: number; shinLead: number;
  thighRear: number; shinRear: number;
  bodyY: number; rigX: number;
}

// Seed values transcribed from the user-approved prototype (GUARD / A_LOAD / A_CONTACT /
// T_HURT / T_REEL). PUNCH_* / KICK_* are the family fallback used by non-strike beats; the
// six per-strike pairs below them are what actual strikes play (M19-C).
const GUARD: RigPose        = { torso: 6,   head: 0,  armLead: 34, foreLead: 128, armRear: 24, foreRear: 126, thighLead: 6,  shinLead: -8,  thighRear: -8,  shinRear: 6,   bodyY: 0,  rigX: 0 };
const PUNCH_LOAD: RigPose    = { torso: -10, head: -4, armLead: 30, foreLead: 132, armRear: 20, foreRear: 150, thighLead: 2,  shinLead: -6,  thighRear: -16, shinRear: 22,  bodyY: 5,  rigX: -3 };
const PUNCH_CONTACT: RigPose = { torso: 18,  head: 6,  armLead: 96, foreLead: 4,   armRear: 20, foreRear: 120, thighLead: 2,  shinLead: -2,  thighRear: 16,  shinRear: -24, bodyY: -2, rigX: -6 };
const KICK_LOAD: RigPose     = { torso: -8,  head: -2, armLead: 40, foreLead: 120, armRear: 30, foreRear: 120, thighLead: 4,  shinLead: -6,  thighRear: -40, shinRear: 70,  bodyY: 2,  rigX: -2 };
const KICK_CONTACT: RigPose  = { torso: 24,  head: 8,  armLead: 50, foreLead: 110, armRear: 40, foreRear: 110, thighLead: 6,  shinLead: -4,  thighRear: 62,  shinRear: 8,   bodyY: -2, rigX: -6 };
const HURT: RigPose          = { torso: 20,  head: 30, armLead: 44, foreLead: 96,  armRear: 52, foreRear: 104, thighLead: 18, shinLead: -22, thighRear: 24,  shinRear: -12, bodyY: 6,  rigX: 14 };
const REEL: RigPose          = { torso: 12,  head: 16, armLead: 38, foreLead: 110, armRear: 34, foreRear: 112, thighLead: 8,  shinLead: -12, thighRear: 12,  shinRear: -6,  bodyY: 3,  rigX: 7 };
const HIT_LEG: RigPose       = { torso: 8,   head: 8,  armLead: 40, foreLead: 110, armRear: 34, foreRear: 112, thighLead: 34, shinLead: -34, thighRear: 6,   shinRear: -4,  bodyY: 4,  rigX: 8 };
// Collapsed pose for knockdown. NO big torso angle here — the 80deg root rotation is applied
// ONCE by HybridRig when pose==='down' (single transform owner; design §9).
const DOWN: RigPose          = { torso: 8,   head: 20, armLead: 120, foreLead: 60, armRear: 110, foreRear: 60, thighLead: 70, shinLead: -30, thighRear: 60, shinRear: -20, bodyY: 10, rigX: 0 };
const SIG_LOAD: RigPose      = { torso: -12, head: -4, armLead: 30, foreLead: 120, armRear: 30, foreRear: 150, thighLead: 2,  shinLead: -6,  thighRear: -18, shinRear: 24,  bodyY: 5,  rigX: -4 };
const SIG_FIRE: RigPose      = { torso: 20,  head: 8,  armLead: 100, foreLead: 2,  armRear: 18,  foreRear: 118, thighLead: 2, shinLead: -2,  thighRear: 18,  shinRear: -26, bodyY: -2, rigX: -8 };
const SLIP: RigPose          = { torso: -6,  head: -10, armLead: 40, foreLead: 120, armRear: 24, foreRear: 120, thighLead: 4, shinLead: -6, thighRear: -6, shinRear: 4,  bodyY: 2,  rigX: -4 };

// ── M19-C per-strike geometry ────────────────────────────────────────────────
// Joint sign conventions (read off the seeds above):
//   torso     +forward lean / rotation into the target, −counter-lean away
//   armX      upper-arm swing out from the ribs (guard ≈ 24–34)
//   foreX     elbow bend; ~130 = folded at the chin, ~0 = fully extended
//   thighRear −chambered behind the hips, + swung forward/up
//   shinRear  + folded under, − whipped out past the knee
//   rigX      − steps in toward the opponent, + gives ground
//
// jab — lead hand only, negligible coil, tiny step. The snap comes from timing.
const JAB_LOAD: RigPose      = { torso: -2,  head: -2, armLead: 26,  foreLead: 134, armRear: 22,  foreRear: 128, thighLead: 4,  shinLead: -6,  thighRear: -10, shinRear: 10,   bodyY: 2,  rigX: -1  };
const JAB_CONTACT: RigPose   = { torso: 8,   head: 4,  armLead: 94,  foreLead: 2,   armRear: 22,  foreRear: 124, thighLead: 4,  shinLead: -4,  thighRear: 6,   shinRear: -10,  bodyY: 0,  rigX: -5  };
// powerPunch — rear hand. Coils the torso away and cocks the rear glove behind the ear,
// then whips through with a deep step. Biggest torso delta of the six.
const POWER_LOAD: RigPose    = { torso: -24, head: -10, armLead: 44, foreLead: 118, armRear: 4,   foreRear: 158, thighLead: -6, shinLead: 4,   thighRear: -30, shinRear: 34,   bodyY: 8,  rigX: 5   };
const POWER_CONTACT: RigPose = { torso: 34,  head: 12, armLead: 30,  foreLead: 138, armRear: 98,  foreRear: 2,   thighLead: 10, shinLead: -8,  thighRear: 30,  shinRear: -34,  bodyY: -4, rigX: -12 };
// elbow — closest punch. Forearm stays FOLDED through contact (that is the read) and the
// whole arm swings across on a short horizontal arc.
const ELBOW_LOAD: RigPose    = { torso: -8,  head: -4, armLead: 18,  foreLead: 152, armRear: 30,  foreRear: 140, thighLead: 8,  shinLead: -8,  thighRear: -14, shinRear: 18,   bodyY: 4,  rigX: -14 };
const ELBOW_CONTACT: RigPose = { torso: 26,  head: 8,  armLead: 122, foreLead: 118, armRear: 34,  foreRear: 132, thighLead: 10, shinLead: -6,  thighRear: 14,  shinRear: -16,  bodyY: -2, rigX: -20 };
// legKick — rear leg chambers low and sweeps through at shin height; torso counter-leans back.
const LEGKICK_LOAD: RigPose    = { torso: -6,  head: -2,  armLead: 44, foreLead: 116, armRear: 28, foreRear: 118, thighLead: 6,  shinLead: -8,  thighRear: -34, shinRear: 58, bodyY: 2,  rigX: -2  };
const LEGKICK_CONTACT: RigPose = { torso: -8,  head: -6,  armLead: 62, foreLead: 96,  armRear: 8,  foreRear: 96,  thighLead: 12, shinLead: -10, thighRear: 44,  shinRear: 18, bodyY: 2,  rigX: -8  };
// bodyKick — same round-kick shape chambered and delivered much higher, shin whipped out,
// with a far bigger counter-lean so the ribs-height arc is unmistakable next to the leg kick.
const BODYKICK_LOAD: RigPose    = { torso: -14, head: -4,  armLead: 16, foreLead: 128, armRear: 34, foreRear: 122, thighLead: 4,  shinLead: -6,  thighRear: -46, shinRear: 86, bodyY: 0,  rigX: -4  };
const BODYKICK_CONTACT: RigPose = { torso: -22, head: -12, armLead: 84, foreLead: 74,  armRear: -6, foreRear: 92,  thighLead: 16, shinLead: -12, thighRear: 78,  shinRear: 2,  bodyY: -2, rigX: -10 };
// knee — clinch range: hands grip and pull down, the rear thigh drives highest of all six and
// the shin stays FOLDED BACK, so there is no outward extension to confuse it with a kick.
const KNEE_LOAD: RigPose     = { torso: -10, head: -4, armLead: 74, foreLead: 142, armRear: 66, foreRear: 144, thighLead: 10, shinLead: -10, thighRear: -22, shinRear: 44,   bodyY: 6,  rigX: -16 };
const KNEE_CONTACT: RigPose  = { torso: 18,  head: 10, armLead: 96, foreLead: 128, armRear: 88, foreRear: 130, thighLead: 22, shinLead: -18, thighRear: 96,  shinRear: -104, bodyY: -8, rigX: -22 };
// finish — the KO/submission blow. `finishStep` is a 'commit' decision, not one of the six
// palette strikes, so it gets its own read rather than the anonymous punch fallback: the deepest
// coil in the game (torso −30) unwinding into the fullest extension (rear arm past powerPunch).
const FINISH_LOAD: RigPose    = { torso: -30, head: -12, armLead: 50, foreLead: 122, armRear: 0,   foreRear: 164, thighLead: -8, shinLead: 6,   thighRear: -34, shinRear: 38,  bodyY: 10, rigX: 6   };
const FINISH_CONTACT: RigPose = { torso: 40,  head: 14,  armLead: 26, foreLead: 142, armRear: 104, foreRear: 0,   thighLead: 12, shinLead: -10, thighRear: 34,  shinRear: -38, bodyY: -6, rigX: -18 };

export const RIG_POSES: Record<PoseName, RigPose> = {
  idle: GUARD,
  guard: GUARD,
  jab: PUNCH_CONTACT,
  cross: PUNCH_CONTACT,
  hook: PUNCH_CONTACT,
  slip: SLIP,
  'hit-head': HURT,
  'hit-body': HURT,
  reel: REEL,
  down: DOWN,
  'sig-load': SIG_LOAD,
  'sig-fire': SIG_FIRE,
  'punch-load': PUNCH_LOAD,
  'punch-contact': PUNCH_CONTACT,
  'kick-load': KICK_LOAD,
  'kick-contact': KICK_CONTACT,
  'hit-leg': HIT_LEG,
  'jab-load': JAB_LOAD,
  'jab-contact': JAB_CONTACT,
  'powerPunch-load': POWER_LOAD,
  'powerPunch-contact': POWER_CONTACT,
  'elbow-load': ELBOW_LOAD,
  'elbow-contact': ELBOW_CONTACT,
  'legKick-load': LEGKICK_LOAD,
  'legKick-contact': LEGKICK_CONTACT,
  'bodyKick-load': BODYKICK_LOAD,
  'bodyKick-contact': BODYKICK_CONTACT,
  'knee-load': KNEE_LOAD,
  'knee-contact': KNEE_CONTACT,
  'finish-load': FINISH_LOAD,
  'finish-contact': FINISH_CONTACT,
};
