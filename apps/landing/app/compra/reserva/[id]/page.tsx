import NominationClient from "./NominationClient";

export const dynamic = "force-dynamic";

export default async function TicketReservationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <NominationClient reservationId={id} />;
}
