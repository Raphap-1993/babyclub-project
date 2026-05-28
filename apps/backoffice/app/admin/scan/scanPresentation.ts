export type ScanQrKind =
  | "table"
  | "ticket_early"
  | "ticket_all_night"
  | "ticket_general"
  | "promoter"
  | "courtesy"
  | "unknown";

export function getQrKindLabel(
  kind?: ScanQrKind | null,
  backendLabel?: string | null,
) {
  if (backendLabel) return backendLabel;
  switch (kind) {
    case "table":
      return "Mesa / Box";
    case "ticket_early":
      return "QR EARLY";
    case "ticket_all_night":
      return "QR ALL NIGHT";
    case "ticket_general":
      return "QR entrada general";
    case "promoter":
      return "QR promotor";
    case "courtesy":
      return "QR cortesía";
    default:
      return "QR";
  }
}

export function getQrKindPresentation(
  kind?: ScanQrKind | null,
  backendLabel?: string | null,
) {
  const label = getQrKindLabel(kind, backendLabel);

  switch (kind) {
    case "table":
      return {
        label,
        kicker: "Mesa / Box",
        hint: "Cupo independiente de mesa o box. Debe leerse una sola vez por QR.",
        panelClass: "border-cyan-500/40 bg-cyan-500/12 text-cyan-50",
        kickerClass: "text-cyan-200",
        hintClass: "text-cyan-100/80",
      };
    case "ticket_early":
      return {
        label,
        kicker: "Entrada EARLY",
        hint: "Entrada comercial EARLY. Sin límite horario de mesa.",
        panelClass: "border-amber-500/40 bg-amber-500/12 text-amber-50",
        kickerClass: "text-amber-200",
        hintClass: "text-amber-100/80",
      };
    case "ticket_all_night":
      return {
        label,
        kicker: "Entrada ALL NIGHT",
        hint: "Entrada comercial ALL NIGHT. Validar contra QR emitido.",
        panelClass: "border-emerald-500/40 bg-emerald-500/12 text-emerald-50",
        kickerClass: "text-emerald-200",
        hintClass: "text-emerald-100/80",
      };
    case "ticket_general":
      return {
        label,
        kicker: "Entrada General",
        hint: "Revisar también la hora límite de ingreso del evento.",
        panelClass: "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-50",
        kickerClass: "text-fuchsia-200",
        hintClass: "text-fuchsia-100/80",
      };
    case "promoter":
      return {
        label,
        kicker: "Promotor",
        hint: "QR atribuido a promotor. Confirmar una sola vez por ingreso.",
        panelClass: "border-sky-500/40 bg-sky-500/12 text-sky-50",
        kickerClass: "text-sky-200",
        hintClass: "text-sky-100/80",
      };
    case "courtesy":
      return {
        label,
        kicker: "Cortesía",
        hint: "QR cortesía. Validar contra el tipo comercial mostrado.",
        panelClass: "border-rose-500/40 bg-rose-500/12 text-rose-50",
        kickerClass: "text-rose-200",
        hintClass: "text-rose-100/80",
      };
    default:
      return {
        label,
        kicker: "QR",
        hint: "Revisa el detalle antes de confirmar el ingreso.",
        panelClass: "border-white/15 bg-white/[0.06] text-white",
        kickerClass: "text-white/60",
        hintClass: "text-white/65",
      };
  }
}
