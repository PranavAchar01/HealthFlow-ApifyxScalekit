import { NextRequest, NextResponse } from "next/server";
import { validateToken, requirePermission } from "@/lib/auth";
import { runAgentPipeline } from "@/agents/agent-pipeline";
import { upsertEncounter } from "@/lib/store";
import { createAuditEntry } from "@/lib/audit";
import { corsHeaders, corsResponse } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const authHeader = req.headers.get("authorization");
  const token = validateToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing Scalekit token" }, { status: 401, headers: corsHeaders(origin) });
  }

  if (!requirePermission(token, "field_data_entry")) {
    return NextResponse.json({ error: "Forbidden: Missing 'field_data_entry' permission" }, { status: 403, headers: corsHeaders(origin) });
  }

  const body = await req.json();
  const { transcript } = body;

  if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
    return NextResponse.json({ error: "Missing or empty 'transcript' field" }, { status: 400, headers: corsHeaders(origin) });
  }

  createAuditEntry("identity_auth", "AUTH_VALIDATE", `Paramedic token validated for ${token.name} (${token.userId}). Role: ${token.role}`, token.userId, token.name);

  const encounter = await runAgentPipeline(transcript, token.userId, token.name);
  upsertEncounter(encounter);

  return NextResponse.json({
    success: true,
    encounter,
    pipeline: {
      agentsExecuted: encounter.auditTrail.length,
      safetyFlags: encounter.safetyFlags?.length ?? 0,
      status: encounter.status,
    },
  }, { headers: corsHeaders(origin) });
}
