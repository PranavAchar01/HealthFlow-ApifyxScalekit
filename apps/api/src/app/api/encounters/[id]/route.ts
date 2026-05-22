import { NextRequest, NextResponse } from "next/server";
import { getEncounter } from "@/lib/store";
import { corsHeaders, corsResponse } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  const encounter = getEncounter(id);
  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404, headers: corsHeaders(origin) });
  }
  return NextResponse.json({ encounter }, { headers: corsHeaders(origin) });
}
