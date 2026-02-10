import { ReactNode } from "react";

type Tone = "default" | "accent" | "muted";

type Props = {
  title: string;
  subtitle?: string;
  value: string;
  icon?: ReactNode;
  pill?: ReactNode;
  tone?: Tone;
};

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const toneStyles: Record<Tone, string> = {
  default: "border-[#1c1c1c] bg-[#111111]",
  accent:
    "border-[#a60c2f]/60 bg-gradient-to-br from-[#1a0a12] via-[#0f0b0f] to-[#0a0a0a] shadow-[0_0_60px_-20px_#a60c2f]",
  muted: "border-[#1a1a1a] bg-[#0c0c0c]",
};

export function CardOverview({
  title,
  subtitle,
  value,
  icon,
  pill,
  tone = "default",
}: Props) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 text-white transition hover:-translate-y-0.5 hover:border-[#a60c2f]/70 hover:shadow-[0_20px_60px_-40px_rgba(166,12,47,0.6)]",
        toneStyles[tone]
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-40" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f2f2f2]/70">
            {pill}
          </div>
          <h3 className="text-lg font-semibold leading-tight text-white">{title}</h3>
          {subtitle ? (
            <p className="text-sm text-[#f2f2f2]/80">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#262626] bg-[#0b0b0b] text-[#a60c2f]">
            {icon}
          </div>
        ) : null}
      </div>
      <div className="relative mt-6 text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </article>
  );
}
