import HomeClient from "./home/HomeClient";
import { getBranding } from "../lib/branding";
import AccessCodeClient from "./AccessCodeClient";

export default async function HomePage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const { logo_url } = await getBranding();
  const params = await searchParams;
  const mode = Array.isArray(params?.mode) ? params.mode[0] : params?.mode;
  if (mode === "nomination" || mode === "access") return <AccessCodeClient initialLogoUrl={logo_url} initialMode={mode} />;
  return <HomeClient initialLogoUrl={logo_url} />;
}
