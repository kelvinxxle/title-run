export type PoseName =
  | 'idle' | 'guard' | 'jab' | 'cross' | 'hook' | 'slip'
  | 'hit-head' | 'hit-body' | 'reel' | 'down' | 'sig-load' | 'sig-fire';

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
};
