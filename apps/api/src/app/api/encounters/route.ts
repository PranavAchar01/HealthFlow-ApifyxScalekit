import { NextRequest, NextResponse } from "next/server";
import { getAllEncounters } from "@/lib/store";
import { corsHeaders, corsResponse } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  return NextResponse.json({ encounters: getAllEncounters() }, { headers: corsHeaders(origin) });
}
