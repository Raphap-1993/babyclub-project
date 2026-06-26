import AccessCodeClient from "./AccessCodeClient";
import { getBranding } from "../lib/branding";
import type { EntryMode } from "./accessCodeViewState";

type AccessCodePageProps = {
  searchParams?:
    | Promise<{ mode?: string | string[] }>
    | { mode?: string | string[] };
};

export default async function AccessCodePage({
  searchParams,
}: AccessCodePageProps) {
  const { logo_url } = await getBranding();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const modeValue = Array.isArray(resolvedSearchParams?.mode)
    ? resolvedSearchParams.mode[0]
    : resolvedSearchParams?.mode;
  const initialMode: EntryMode =
    modeValue === "nomination" ? "nomination" : "access";

  return (
    <AccessCodeClient initialLogoUrl={logo_url} initialMode={initialMode} />
  );
}
