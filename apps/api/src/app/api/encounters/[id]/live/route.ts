import { NextRequest, NextResponse } from "next/server";
import { validateToken, requirePermission } from "@/lib/auth";
import { getEncounter, setActiveSelection } from "@/lib/store";
import { runLiveCapture, runDownstream } from "@/agents/agent-pipeline";
import { corsHeaders, corsResponse } from "@/lib/cors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

// POST /api/encounters/[id]/live
// Streaming field capture: a paramedic dictating pushes the accumulated transcript
// here every few seconds. We re-run structuring + diagnosis so the nurse and doctor
// CRMs fill in live as they talk. Pass { finalize: true } on stop to run the full
// downstream reasoning (orders, safety, nurse assessment, nurse care plan).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const token = validateToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
  }
  if (!requirePermission(token, "field_data_entry")) {
    return NextResponse.json({ error: "Forbidden: Missing 'field_data_entry' permission" }, { status: 403, headers: corsHeaders(origin) });
  }

  const { id } = await params;
  const encounter = await getEncounter(id);
  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404, headers: corsHeaders(origin) });
  }

  const body = await req.json();
  const transcript: string = typeof body.transcript === "string" ? body.transcript : encounter.rawTranscript;
  const finalize: boolean = body.finalize === true;
  const select: boolean = body.select !== false; // default: focus everyone on the patient being captured

  if (!transcript.trim()) {
    return NextResponse.json({ error: "Empty transcript" }, { status: 400, headers: corsHeaders(origin) });
  }

  if (select) setActiveSelection(encounter.id);

  // Live capture is light; await it so the response reflects the latest read.
  await runLiveCapture(encounter, transcript, finalize);

  // On finalize, run the heavier downstream in the background — SSE streams results.
  if (finalize) {
    void runDownstream(encounter).catch((err) =>
      console.error("[live] downstream error:", err instanceof Error ? err.message : err)
    );
  }

  return NextResponse.json({ encounter, finalize }, { headers: corsHeaders(origin) });
}
