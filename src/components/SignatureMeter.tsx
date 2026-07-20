interface Props {
  charge: number; // 0–100
}

export default function SignatureMeter({ charge }: Props) {
  const pct = Math.min(100, Math.max(0, charge));
  const isReady = pct >= 100;

  return (
    <div data-testid="signature-meter" className="w-full flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className={`font-mono text-xs uppercase tracking-widest ${isReady ? 'text-primary ready' : 'text-on-surface-variant'}`}>
          Signature
        </span>
        {isReady && (
          <span className="font-mono text-xs uppercase tracking-widest text-primary animate-pulse">
            READY
          </span>
        )}
      </div>
      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden border border-outline">
        <div
          className={`h-full transition-all duration-300 rounded-full ${isReady ? 'bg-primary glow shadow-[0_0_8px_2px_rgba(var(--color-primary),0.7)]' : 'bg-primary opacity-60'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
