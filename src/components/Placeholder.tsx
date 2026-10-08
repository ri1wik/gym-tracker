export function Placeholder({ title, line }: { title: string; line: string }) {
  return (
    <section className="space-y-4">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
      <div className="rounded-card border border-line bg-surface-1 p-4">
        <p className="text-[15px] leading-relaxed text-ink-2">{line}</p>
      </div>
    </section>
  )
}
