export type Where = 'strike' | 'wrestle' | 'grapple';
export type Target = 'head' | 'body';
export type Approach = 'pressure' | 'technical' | 'counter';

export interface RoundIntent { where: Where; target: Target; approach: Approach; }

export const WHERES: readonly Where[] = ['strike','wrestle','grapple'] as const;
export const TARGETS: readonly Target[] = ['head','body'] as const;
export const APPROACHES: readonly Approach[] = ['pressure','technical','counter'] as const;

export const INTENT_LABELS = {
  where: { strike: 'Strike', wrestle: 'Wrestle', grapple: 'Grapple' } as Record<Where,string>,
  target: { head: 'Head', body: 'Body' } as Record<Target,string>,
  approach: { pressure: 'Pressure', technical: 'Technical', counter: 'Counter' } as Record<Approach,string>,
};
