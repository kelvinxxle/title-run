import { useState } from 'react';
import FighterAvatar from './FighterAvatar';

export interface FighterImageProps {
  fighterId?: string;
  name: string;
  archetype: string;
  seed?: string;
  size?: number;
  variant?: 'portrait' | 'hero';
}

export default function FighterImage({
  fighterId,
  name,
  archetype,
  seed,
  size = 48,
  variant = 'portrait',
}: FighterImageProps): JSX.Element {
  const [failedId, setFailedId] = useState<string | undefined>(undefined);
  const avatarSeed = seed ?? fighterId ?? name;
  const showAvatar = !fighterId || failedId === fighterId;

  if (showAvatar) {
    if (variant === 'hero') {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
          <FighterAvatar seed={avatarSeed} archetype={archetype} name={name} size={220} />
        </div>
      );
    }
    return <FighterAvatar seed={avatarSeed} archetype={archetype} name={name} size={size} />;
  }

  const src = `${import.meta.env.BASE_URL}fighters/${fighterId}.jpg`;

  if (variant === 'hero') {
    return (
      <img
        data-testid="fighter-photo"
        src={src}
        alt={name}
        onError={() => setFailedId(fighterId)}
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
    );
  }

  return (
    <img
      data-testid="fighter-photo"
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailedId(fighterId)}
      className="rounded object-cover"
      style={{ width: size, height: size }}
    />
  );
}
