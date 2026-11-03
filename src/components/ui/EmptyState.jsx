export default function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <Icon size={40} weight="duotone" className="text-zinc-600 dark:text-zinc-400" />
      <p className="text-lg font-bold">{title}</p>
      {text && <p className="max-w-[44ch] text-sm text-zinc-700 dark:text-zinc-300">{text}</p>}
      {children}
    </div>
  );
}
