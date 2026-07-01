interface DraftProgressProps {
  filled: number;
  total: number;
}

export default function DraftProgress({ filled, total }: DraftProgressProps) {
  const pct = Math.round((filled / total) * 100);
  return (
    <div className="w-full max-w-lg mb-md">
      <div className="flex justify-between items-end mb-xs">
        <h2 className="font-display text-2xl uppercase text-on-surface leading-none">
          Build Your Fighter
        </h2>
        <span className="font-mono text-xs uppercase tracking-widest text-primary">
          Stat {filled}/{total} Filled
        </span>
      </div>
      <div className="w-full h-2 bg-surface-container-highest overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
