import EventCloseWorkspace from "../components/EventCloseWorkspace";

export default async function ReporteMesasPage({
  searchParams,
}: {
  searchParams?: Promise<{ report?: string; event_id?: string }>;
}) {
  const params = await searchParams;
  const initialView =
    params?.report === "event_sales"
      ? "income"
      : params?.report === "free_qr_no_show" ||
          params?.report === "event_attendance"
        ? "attendance"
        : "summary";
  return (
    <EventCloseWorkspace
      initialView={initialView}
      initialEventId={params?.event_id}
    />
  );
}
