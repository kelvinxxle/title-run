import { SCREENS, type ScreenId } from '../navigation/screens';

interface BottomNavBarProps {
  current: ScreenId;
  onNavigate: (id: ScreenId) => void;
}

export default function BottomNavBar({
  current,
  onNavigate,
}: BottomNavBarProps) {
  return (
    <nav className="flex bg-surface border-t-2 border-outline-variant">
      {SCREENS.map((s) => {
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(s.id)}
            className={`flex-1 py-sm font-mono text-xs uppercase tracking-widest ${
              active ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
