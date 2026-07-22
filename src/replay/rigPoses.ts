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
// T_HURT / T_REEL). Kick + hit-leg values are art seeds — TUNE IN FEEL-GATE v2 (Task 12).
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
};
