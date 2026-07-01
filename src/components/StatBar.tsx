interface StatBarProps {
  value: number;
  highlighted?: boolean;
}

const SEGMENTS = 10;

export default function StatBar({ value, highlighted = false }: StatBarProps) {
  const filled = Math.max(1, Math.round((value / 99) * SEGMENTS));
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={1}
      aria-valuemax={99}
      className="flex gap-[2px]"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-3 ${
            i < filled
              ? highlighted
                ? 'bg-primary'
                : 'bg-tertiary'
              : 'bg-surface-container-highest'
          }`}
        />
      ))}
    </div>
  );
}
