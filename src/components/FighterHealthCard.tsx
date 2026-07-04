import FighterAvatar from './FighterAvatar';

interface FighterHealthCardProps {
  side: 'player' | 'opponent';
  name: string;
  subtitle: string;
  badge: string;
  healthPct: number;
  read?: string;
  avatarSeed?: string;
  archetype?: string;
}

const SEGMENTS = 10;

export default function FighterHealthCard({
  side,
  name,
  subtitle,
  badge,
  healthPct,
  read,
  avatarSeed,
  archetype,
}: FighterHealthCardProps) {
  const clamped = Math.min(1, Math.max(0, healthPct));
  const filled = Math.round(clamped * SEGMENTS);
  const isOpponent = side === 'opponent';
  const accent = isOpponent ? 'border-r-4 border-secondary' : 'border-l-4 border-primary';
  const badgeColor = isOpponent ? 'text-secondary' : 'text-primary';
  const fillColor = isOpponent ? 'bg-secondary' : 'bg-primary';

  return (
    <div
      data-testid={`fighter-card-${side}`}
      className={`flex-1 bg-surface-container ${accent} p-md flex flex-col gap-xs`}
    >
      <div className="flex items-start justify-between gap-xs">
        {avatarSeed && archetype ? (
          <div className="flex items-center gap-xs">
            <FighterAvatar seed={avatarSeed} archetype={archetype} name={name} size={40} />
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
      <div
        role="meter"
        aria-label={`${name} health`}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="flex gap-[2px] mt-xs"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 ${i < filled ? fillColor : 'bg-surface-container-highest'}`}
          />
        ))}
      </div>
      {read && (
        <p className="font-body text-sm text-on-surface-variant mt-xs">{read}</p>
      )}
    </div>
  );
}
