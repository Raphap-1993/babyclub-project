type Props = {
  label: string;
  variant?: "accent" | "muted";
};

export function StatPill({ label, variant = "accent" }: Props) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]";
  const styles =
    variant === "accent"
      ? "bg-[#a60c2f] text-white shadow-[0_10px_30px_-15px_rgba(166,12,47,0.75)]"
      : "bg-[#151515] text-[#f2f2f2]/80 border border-[#262626]";

  return <span className={`${base} ${styles}`}>{label}</span>;
}
