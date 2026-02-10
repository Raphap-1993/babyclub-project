import AccessCodeClient from "./AccessCodeClient";
import { getBranding } from "../lib/branding";

export default async function AccessCodePage() {
  const { logo_url } = await getBranding();
  return <AccessCodeClient initialLogoUrl={logo_url} />;
}
