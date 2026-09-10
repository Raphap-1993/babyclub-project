import { redirect } from "next/navigation";
import {
  legacyReportHref,
  type ReportSearchParams,
} from "../reportes/navigation";

export const dynamic = "force-dynamic";

export default async function IngresosPage({
  searchParams,
}: { searchParams?: Promise<ReportSearchParams> } = {}) {
  redirect(legacyReportHref(await searchParams, "income"));
}
