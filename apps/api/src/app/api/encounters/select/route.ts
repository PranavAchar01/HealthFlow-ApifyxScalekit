import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { getEncounter, setActiveSelection } from "@/lib/store";
import { corsHeaders, corsResponse } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

// POST /api/encounters/select  { id: string | null }
// Broadcasts the "active patient" so every connected CRM focuses the same encounter.
// Pass id: null to clear the shared selection.
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const token = validateToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
  }

  const body = await req.json();
  const id: string | null = body.id ?? null;

  if (id !== null) {
    const encounter = await getEncounter(id);
    if (!encounter) {
      return NextResponse.json({ error: "Encounter not found" }, { status: 404, headers: corsHeaders(origin) });
    }
  }

  setActiveSelection(id);
  return NextResponse.json({ ok: true, selectedId: id }, { headers: corsHeaders(origin) });
}
