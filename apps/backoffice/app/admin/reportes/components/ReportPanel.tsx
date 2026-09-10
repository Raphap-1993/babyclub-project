import type { ReactNode } from "react";

export default function ReportPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#111111] p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description && (
        <p className="mt-1 max-w-xl text-xs leading-5 text-neutral-400">
          {description}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}
