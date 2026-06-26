import { EntryMode } from "./accessCodeViewState";

type AccessModeToggleProps = {
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
};

export function AccessModeToggle({
  mode,
  onModeChange,
}: AccessModeToggleProps) {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-full border border-white/10 bg-white/[0.04] p-1">
      <div className="grid grid-cols-2 gap-1">
        {([
          ["access", "Entrar"],
          ["nomination", "Nominación"],
        ] as const).map(([value, label]) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(value)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition ${
                active
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
