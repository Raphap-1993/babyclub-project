import { getTicketKindPresentation } from "shared/ticketKindPresentation";

type TicketKindBadgeProps = {
  codeType?: string | null;
  reservationSaleOrigin?: string | null;
  ticketTypeLabel?: string | null;
  tableName?: string | null;
  promoterName?: string | null;
  showKicker?: boolean;
  className?: string;
};

export function TicketKindBadge({
  codeType,
  reservationSaleOrigin,
  ticketTypeLabel,
  tableName,
  promoterName,
  showKicker = false,
  className,
}: TicketKindBadgeProps) {
  const presentation = getTicketKindPresentation({
    codeType,
    reservationSaleOrigin,
    ticketTypeLabel,
    hasTableContext: Boolean(tableName),
    hasPromoter: Boolean(promoterName),
  });

  const rootClassName = [
    "inline-flex max-w-full items-start gap-2 rounded-xl border px-2.5 py-1.5",
    presentation.badgeClassName,
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!showKicker) {
    return (
      <span className={rootClassName} title={presentation.kicker}>
        <span className="truncate text-xs font-semibold">{presentation.label}</span>
      </span>
    );
  }

  return (
    <span className={rootClassName}>
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">
          {presentation.kicker}
        </span>
        <span className="truncate text-xs font-semibold">{presentation.label}</span>
      </span>
    </span>
  );
}
