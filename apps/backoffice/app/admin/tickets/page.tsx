import AuthenticatedSalesView from "../AuthenticatedSalesView";
export default async function TicketsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = (await searchParams) || {};
  const params = Object.fromEntries(
    Object.entries(input).filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  return <AuthenticatedSalesView view="tickets" params={params} />;
}
