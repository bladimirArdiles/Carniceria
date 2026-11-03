export default function Segmented({ label, value, onChange, options, cols }) {
  return (
    <div>
      {label && <span className="label" id={`seg-${label}`}>{label}</span>}
      <div
        role="radiogroup"
        aria-labelledby={label ? `seg-${label}` : undefined}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols || options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const on = value === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={o.disabled}
              onClick={() => onChange(o.value)}
              className={
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 text-sm font-bold transition active:scale-95 disabled:opacity-40 " +
                (on
                  ? "border-accent-400 bg-accent-400 text-zinc-950"
                  : "border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800")
              }
            >
              {Icon && <Icon size={22} weight={on ? "fill" : "bold"} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
