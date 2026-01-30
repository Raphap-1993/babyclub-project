type ComingSoonProps = {
  title: string;
  description?: string;
};

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#0c0c0c] px-6 py-10 text-center text-white shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
      <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
        Módulo en desarrollo
      </span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-xl text-sm text-white/70">
        {description || "Estamos terminando esta sección. Pronto podrás gestionarla desde aquí."}
      </p>
    </div>
  );
}
