import AuthenticatedSalesView from "../../AuthenticatedSalesView";
export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AuthenticatedSalesView view="ticket" params={{ id: (await params).id }} />
  );
}
