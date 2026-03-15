import { NextResponse } from "next/server";
import { getBranding } from "shared/branding";

export async function GET() {
  const { logo_url } = await getBranding();
  return NextResponse.json({ logo_url });
}
