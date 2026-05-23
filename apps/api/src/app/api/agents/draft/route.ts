import { NextRequest, NextResponse } from "next/server";
import { validateToken, requirePermission } from "@/lib/auth";
import { runAgentPipeline } from "@/agents/agent-pipeline";
import { upsertEncounter } from "@/lib/store";
import { createAuditEntry } from "@/lib/audit";
import { corsHeaders, corsResponse } from "@/lib/cors";
import { createServerSupabase } from "@/lib/supabase";

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
  const { transcript, patientContext } = body;

  if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
    return NextResponse.json({ error: "Missing or empty 'transcript' field" }, { status: 400, headers: corsHeaders(origin) });
  }

  createAuditEntry("identity_auth", "AUTH_VALIDATE", `Paramedic token validated for ${token.name} (${token.userId}). Role: ${token.role}`, token.userId, token.name);

  const encounter = await runAgentPipeline(transcript, token.userId, token.name, { patientContext });
  await upsertEncounter(encounter);

  // Mirror pipeline results to HealthFlow_transcript so nurse/doctor views
  // (which poll that table directly) pick up the output within their next poll.
  const pId = encounter.patientContext?.patientId;
  if (pId) {
    const sb = createServerSupabase();
    if (sb) {
      sb.from('HealthFlow_transcript')
        .update({
          structuredData      : JSON.stringify(encounter.structuredData      ?? null),
          diagnosis           : JSON.stringify(encounter.diagnosis           ?? null),
          draftOrders         : JSON.stringify(encounter.draftOrders         ?? []),
          safetyFlags         : JSON.stringify(encounter.safetyFlags         ?? []),
          safetyRecommendation: encounter.safetyRecommendation ?? null,
          auditTrail          : JSON.stringify(encounter.auditTrail          ?? []),
          status              : encounter.status,
          acuity              : encounter.acuity,
          encounterId         : encounter.id,
          updatedAt           : new Date().toISOString(),
        })
        .eq('patientId', pId)
        .then(({ error }) => {
          if (error) console.error('[api/draft] HealthFlow_transcript write-back error:', error);
        });
    }
  }

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
