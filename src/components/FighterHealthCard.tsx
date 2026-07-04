import FighterImage from './FighterImage';

interface FighterHealthCardProps {
  side: 'player' | 'opponent';
  name: string;
  subtitle: string;
  badge: string;
  healthPct: number;
  bodyPct: number;
  staminaPct: number;
  headStateLabel: 'fresh' | 'hurt' | 'rocked';
  damageFlash?: { head: number; body: number };
  read?: string;
  avatarSeed?: string;
  archetype?: string;
  fighterId?: string;
}

const SEGMENTS = 10;

function SegmentedBar({
  pct,
  fillColor,
  role,
  ariaLabel,
  testId,
  height = 'h-3',
}: {
  pct: number;
  fillColor: string;
  role: string;
  ariaLabel: string;
  testId: string;
  height?: string;
}) {
  const clamped = Math.min(1, Math.max(0, pct));
  const filled = Math.round(clamped * SEGMENTS);

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid={testId}
      className="flex gap-[2px] transition-all duration-300"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`${height} flex-1 transition-all duration-300 ${i < filled ? fillColor : 'bg-surface-container-highest'}`}
        />
      ))}
    </div>
  );
}

export default function FighterHealthCard({
  side,
  name,
  subtitle,
  badge,
  healthPct,
  bodyPct,
  staminaPct,
  headStateLabel,
  damageFlash,
  read,
  avatarSeed,
  archetype,
  fighterId,
}: FighterHealthCardProps) {
  const isOpponent = side === 'opponent';
  const accent = isOpponent ? 'border-r-4 border-secondary' : 'border-l-4 border-primary';
  const badgeColor = isOpponent ? 'text-secondary' : 'text-primary';
  const headFill =
    headStateLabel === 'rocked'
      ? 'bg-red-500'
      : headStateLabel === 'hurt'
        ? 'bg-amber-400'
        : isOpponent
          ? 'bg-secondary'
          : 'bg-primary';
  const bodyFill = 'bg-orange-400';
  const gasFill = 'bg-cyan-400';

  return (
    <div
      data-testid={`fighter-card-${side}`}
      data-head-state={headStateLabel}
      className={`flex-1 bg-surface-container ${accent} p-md flex flex-col gap-xs ${headStateLabel === 'rocked' ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start justify-between gap-xs">
        {avatarSeed && archetype ? (
          <div className="flex items-center gap-xs">
            <FighterImage fighterId={fighterId} name={name} archetype={archetype} seed={avatarSeed} size={40} />
            <h3 className="font-display text-2xl uppercase leading-tight text-on-surface">{name}</h3>
          </div>
        ) : (
          <h3 className="font-display text-2xl uppercase leading-tight text-on-surface">{name}</h3>
        )}
        <span className={`font-mono text-[10px] uppercase tracking-widest ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
        {subtitle}
      </p>

      <div className="relative">
        <div className="mb-[2px] flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">HEAD</span>
          {damageFlash && damageFlash.head > 0 && (
            <span data-testid={`dmg-${side}-head`} className="font-mono text-xs text-red-400 animate-bounce">
              −
              {damageFlash.head}
            </span>
          )}
        </div>
        <SegmentedBar
          pct={healthPct}
          fillColor={headFill}
          role="meter"
          ariaLabel={`${name} health`}
          testId={`meter-head-${side}`}
        />
      </div>

      <div className="relative">
        <div className="mb-[2px] flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">BODY</span>
          {damageFlash && damageFlash.body > 0 && (
            <span data-testid={`dmg-${side}-body`} className="font-mono text-xs text-orange-400">
              −
              {damageFlash.body}
            </span>
          )}
        </div>
        <SegmentedBar
          pct={bodyPct}
          fillColor={bodyFill}
          role="meter"
          ariaLabel={`${name} body`}
          testId={`meter-body-${side}`}
          height="h-2"
        />
      </div>

      <div>
        <span className="mb-[2px] block font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">GAS</span>
        <SegmentedBar
          pct={staminaPct}
          fillColor={gasFill}
          role="meter"
          ariaLabel={`${name} stamina`}
          testId={`meter-gas-${side}`}
          height="h-2"
        />
      </div>

      {read && (
        <p className="font-body text-sm text-on-surface-variant mt-xs">{read}</p>
      )}
    </div>
  );
}
