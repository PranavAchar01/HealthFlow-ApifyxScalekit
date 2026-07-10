import { NextRequest, NextResponse } from "next/server";
import { getAllEncounters, clearAllEncounters } from "@/lib/store";
import { validateToken } from "@/lib/auth";
import { corsHeaders, corsResponse } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const encounters = await getAllEncounters();
  return NextResponse.json({ encounters }, { headers: corsHeaders(origin) });
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const token = validateToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
  }
  await clearAllEncounters();
  return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
}
