export type LegalConfig = {
  tradeName: string;
  legalName: string;
  ruc: string;
  address: string;
  phone: string;
  supportEmail: string;
  claimsEmail: string;
  instagram: string;
  lastUpdated: string;
};

const fallback = (value: string | undefined, defaultValue: string) =>
  value?.trim() || defaultValue;

export function getLegalConfig(): LegalConfig {
  const supportEmail = fallback(
    process.env.NEXT_PUBLIC_BABY_SUPPORT_EMAIL,
    "Correo pendiente de publicación",
  );

  return {
    tradeName: fallback(process.env.NEXT_PUBLIC_BABY_TRADE_NAME, "Baby Club"),
    legalName: fallback(
      process.env.NEXT_PUBLIC_BABY_LEGAL_NAME,
      "Razón social pendiente",
    ),
    ruc: fallback(process.env.NEXT_PUBLIC_BABY_RUC, "RUC pendiente"),
    address: fallback(
      process.env.NEXT_PUBLIC_BABY_ADDRESS,
      "Dirección pendiente de publicación",
    ),
    phone: fallback(process.env.NEXT_PUBLIC_BABY_PHONE, "Teléfono pendiente"),
    supportEmail,
    claimsEmail: fallback(process.env.BABY_CLAIMS_EMAIL, supportEmail),
    instagram: fallback(
      process.env.NEXT_PUBLIC_BABY_INSTAGRAM,
      "@baby.club_______",
    ),
    lastUpdated: fallback(
      process.env.NEXT_PUBLIC_BABY_LEGAL_LAST_UPDATED,
      "27 de abril de 2026",
    ),
  };
}

export { legalLinks } from "./legalLinks";
