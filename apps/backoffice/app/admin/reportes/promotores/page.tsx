import { redirect } from "next/navigation";
import { legacyReportHref, type ReportSearchParams } from "../navigation";

export const dynamic = "force-dynamic";

export default async function ReportePromotoresPage({
  searchParams,
}: { searchParams?: Promise<ReportSearchParams> } = {}) {
  redirect(legacyReportHref(await searchParams, "promoters"));
}
