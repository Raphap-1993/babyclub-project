import CodeEntryClient from "./CodeEntryClient";
import { getBranding } from "../../lib/branding";

export default async function CodeEntryPage() {
  const { logo_url } = await getBranding();
  return <CodeEntryClient initialLogoUrl={logo_url} />;
}
