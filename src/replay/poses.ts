export type PoseName =
  | 'idle' | 'guard' | 'jab' | 'cross' | 'hook' | 'slip'
  | 'hit-head' | 'hit-body' | 'reel' | 'down' | 'sig-load' | 'sig-fire'
  | 'punch-load' | 'punch-contact' | 'kick-load' | 'kick-contact' | 'hit-leg'
  // M19-C per-strike choreography — one load/contact pair per StrikeId, so the tactic the
  // player picked is legible on screen. `punch-*` / `kick-*` above stay as the family
  // fallback for non-strike beats (advance/evade/counter/impact/knockdown).
  | 'jab-load' | 'jab-contact'
  | 'powerPunch-load' | 'powerPunch-contact'
  | 'elbow-load' | 'elbow-contact'
  | 'legKick-load' | 'legKick-contact'
  | 'bodyKick-load' | 'bodyKick-contact'
  | 'knee-load' | 'knee-contact'
  | 'finish-load' | 'finish-contact';

export interface Pose {
  torsoRotate: number;
  headX: number;
  headY: number;
  leadArm: { rotate: number; extend: number };
  rearArm: { rotate: number; extend: number };
  lean: number;
}

export const POSES: Record<PoseName, Pose> = {
  idle:       { torsoRotate: 0,   headX: 0,   headY: 0,  leadArm: { rotate: 30,  extend: 0.3  }, rearArm: { rotate: -20, extend: 0.2  }, lean: 0  },
  guard:      { torsoRotate: 5,   headX: 0,   headY: 0,  leadArm: { rotate: 80,  extend: 0.5  }, rearArm: { rotate: 60,  extend: 0.5  }, lean: 0  },
  jab:        { torsoRotate: -5,  headX: 0,   headY: 0,  leadArm: { rotate: 10,  extend: 0.9  }, rearArm: { rotate: 50,  extend: 0.4  }, lean: 8  },
  cross:      { torsoRotate: 15,  headX: 2,   headY: 0,  leadArm: { rotate: 70,  extend: 0.4  }, rearArm: { rotate: -5,  extend: 0.95 }, lean: 12 },
  hook:       { torsoRotate: 20,  headX: 0,   headY: 0,  leadArm: { rotate: 90,  extend: 0.7  }, rearArm: { rotate: 55,  extend: 0.4  }, lean: 5  },
  slip:       { torsoRotate: -8,  headX: -8,  headY: 2,  leadArm: { rotate: 40,  extend: 0.3  }, rearArm: { rotate: 20,  extend: 0.3  }, lean: -5 },
  'hit-head': { torsoRotate: -10, headX: 6,   headY: -2, leadArm: { rotate: 60,  extend: 0.4  }, rearArm: { rotate: 40,  extend: 0.3  }, lean: -4 },
  'hit-body': { torsoRotate: 25,  headX: 0,   headY: 3,  leadArm: { rotate: 50,  extend: 0.4  }, rearArm: { rotate: 30,  extend: 0.4  }, lean: 0  },
  reel:       { torsoRotate: -15, headX: 8,   headY: -4, leadArm: { rotate: 80,  extend: 0.3  }, rearArm: { rotate: 60,  extend: 0.3  }, lean: -8 },
  down:       { torsoRotate: 80,  headX: 10,  headY: 10, leadArm: { rotate: 120, extend: 0.5  }, rearArm: { rotate: 100, extend: 0.5  }, lean: 20 },
  'sig-load': { torsoRotate: -5,  headX: -4,  headY: 0,  leadArm: { rotate: 30,  extend: 0.3  }, rearArm: { rotate: 40,  extend: 0.4  }, lean: -6 },
  'sig-fire': { torsoRotate: 10,  headX: 3,   headY: 0,  leadArm: { rotate: 60,  extend: 0.4  }, rearArm: { rotate: -10, extend: 0.95 }, lean: 15 },
  'punch-load':    { torsoRotate: -8,  headX: -2, headY: 0, leadArm: { rotate: 20, extend: 0.4 }, rearArm: { rotate: 50, extend: 0.5  }, lean: -4 },
  'punch-contact': { torsoRotate: 16,  headX: 3,  headY: 0, leadArm: { rotate: 70, extend: 0.4 }, rearArm: { rotate: -5, extend: 0.95 }, lean: 12 },
  'kick-load':     { torsoRotate: -6,  headX: -2, headY: 0, leadArm: { rotate: 40, extend: 0.4 }, rearArm: { rotate: 30, extend: 0.4  }, lean: -3 },
  'kick-contact':  { torsoRotate: 22,  headX: 4,  headY: 0, leadArm: { rotate: 50, extend: 0.4 }, rearArm: { rotate: 40, extend: 0.4  }, lean: 6  },
  'hit-leg':       { torsoRotate: 8,   headX: 6,  headY: 3, leadArm: { rotate: 50, extend: 0.4 }, rearArm: { rotate: 40, extend: 0.4  }, lean: 4  },

  // ── M19-C per-strike pairs ──────────────────────────────────────────────────
  // jab — lead hand, almost no coil, snaps straight out and back.
  'jab-load':           { torsoRotate: -2,  headX: -1, headY: 0,  leadArm: { rotate: 26,  extend: 0.35 }, rearArm: { rotate: 50, extend: 0.45 }, lean: -1  },
  'jab-contact':        { torsoRotate: 8,   headX: 2,  headY: 0,  leadArm: { rotate: 94,  extend: 0.98 }, rearArm: { rotate: 50, extend: 0.45 }, lean: 5   },
  // powerPunch — rear hand, deep coil away, then full torso rotation through the target.
  'powerPunch-load':    { torsoRotate: -24, headX: -6, headY: 0,  leadArm: { rotate: 44,  extend: 0.4  }, rearArm: { rotate: 4,  extend: 0.15 }, lean: -10 },
  'powerPunch-contact': { torsoRotate: 34,  headX: 6,  headY: 0,  leadArm: { rotate: 30,  extend: 0.25 }, rearArm: { rotate: 98, extend: 1.0  }, lean: 18  },
  // elbow — already inside; the arm stays folded and cuts a short horizontal arc.
  'elbow-load':         { torsoRotate: -8,  headX: -3, headY: 0,  leadArm: { rotate: 18,  extend: 0.12 }, rearArm: { rotate: 30, extend: 0.3  }, lean: -4  },
  'elbow-contact':      { torsoRotate: 26,  headX: 4,  headY: -2, leadArm: { rotate: 122, extend: 0.35 }, rearArm: { rotate: 34, extend: 0.35 }, lean: 9   },
  // legKick — rear leg chops low; torso counter-leans away from the swing.
  'legKick-load':       { torsoRotate: -6,  headX: -2, headY: 0,  leadArm: { rotate: 44,  extend: 0.45 }, rearArm: { rotate: 28, extend: 0.45 }, lean: -3  },
  'legKick-contact':    { torsoRotate: -8,  headX: -3, headY: 2,  leadArm: { rotate: 62,  extend: 0.6  }, rearArm: { rotate: 8,  extend: 0.6  }, lean: -8  },
  // bodyKick — same shape swung clearly higher, with a much bigger counter-lean.
  'bodyKick-load':      { torsoRotate: -14, headX: -3, headY: 0,  leadArm: { rotate: 16,  extend: 0.5  }, rearArm: { rotate: 34, extend: 0.45 }, lean: -6  },
  'bodyKick-contact':   { torsoRotate: -22, headX: -6, headY: 3,  leadArm: { rotate: 84,  extend: 0.7  }, rearArm: { rotate: -6, extend: 0.7  }, lean: -16 },
  // knee — clinch range, vertical drive, no outward leg extension.
  'knee-load':          { torsoRotate: -10, headX: -2, headY: 1,  leadArm: { rotate: 74,  extend: 0.3  }, rearArm: { rotate: 66, extend: 0.3  }, lean: -4  },
  'knee-contact':       { torsoRotate: 18,  headX: 3,  headY: -3, leadArm: { rotate: 96,  extend: 0.4  }, rearArm: { rotate: 88, extend: 0.4  }, lean: 10  },
  // finish — the committed KO blow: deepest coil, fullest extension.
  'finish-load':        { torsoRotate: -30, headX: -12, headY: 2, leadArm: { rotate: 50,  extend: 0.35 }, rearArm: { rotate: 0,   extend: 0.1 }, lean: -14 },
  'finish-contact':     { torsoRotate: 40,  headX: 14,  headY: 0, leadArm: { rotate: 26,  extend: 0.2  }, rearArm: { rotate: 104, extend: 1.0 }, lean: 22  },
};
