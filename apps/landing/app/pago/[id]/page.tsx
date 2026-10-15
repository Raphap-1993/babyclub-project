import MercadoPagoCheckout from "./MercadoPagoCheckout";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <MercadoPagoCheckout id={(await params).id} />;
}
