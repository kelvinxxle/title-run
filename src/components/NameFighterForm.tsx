import { useState } from 'react';

interface NameFighterFormProps {
  onSubmit: (name: string) => void;
}

export default function NameFighterForm({ onSubmit }: NameFighterFormProps) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <form
      className="w-full max-w-md flex flex-col gap-sm items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed.length > 0) {
          onSubmit(trimmed);
        }
      }}
    >
      <h2 className="font-display text-2xl uppercase text-primary">Name Your Fighter</h2>
      <input
        type="text"
        aria-label="Fighter name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter a name"
        className="w-full bg-surface-container border-2 border-outline p-sm font-body text-on-surface"
      />
      <button
        type="submit"
        disabled={trimmed.length === 0}
        className="w-full bg-primary text-on-primary font-display text-xl uppercase py-sm disabled:opacity-40"
      >
        Confirm Fighter
      </button>
    </form>
  );
}
