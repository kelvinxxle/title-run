import { describe, it, expect } from 'vitest';
import { WHERES, TARGETS, APPROACHES, INTENT_LABELS } from './intents';

describe('round intents', () => {
  it('offers 3 wheres, 2 targets, 3 approaches', () => {
    expect(WHERES).toEqual(['strike','wrestle','grapple']);
    expect(TARGETS).toEqual(['head','body']);
    expect(APPROACHES).toEqual(['pressure','technical','counter']);
  });
  it('labels every choice for the UI', () => {
    for (const w of WHERES) expect(INTENT_LABELS.where[w]).toBeTruthy();
    for (const t of TARGETS) expect(INTENT_LABELS.target[t]).toBeTruthy();
    for (const a of APPROACHES) expect(INTENT_LABELS.approach[a]).toBeTruthy();
  });
});
