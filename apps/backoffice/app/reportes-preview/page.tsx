import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";
import EventCloseWorkspace from "../admin/reportes/components/EventCloseWorkspace";
import type { EventCloseReport } from "@/lib/reports/eventClose";

export const dynamic = "force-dynamic";

/** Local review only; no credentials or authenticated endpoint bypass. File contains aggregates only. */
export default async function ReportsPreview() {
  if (
    process.env.NODE_ENV !== "development" ||
    !process.env.REPORTS_PREVIEW_FILE
  )
    notFound();
  const reports = JSON.parse(
    await readFile(process.env.REPORTS_PREVIEW_FILE, "utf8"),
  ) as EventCloseReport[];
  return (
    <main className="min-h-screen p-4 text-white sm:p-8">
      <EventCloseWorkspace previewReports={reports} />
    </main>
  );
}
