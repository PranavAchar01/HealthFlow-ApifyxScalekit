import { NextRequest, NextResponse } from "next/server";
import { validateToken, requirePermission } from "@/lib/auth";
import { runAgentPipeline } from "@/agents/agent-pipeline";
import { upsertEncounter } from "@/lib/store";
import { createAuditEntry } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = validateToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing Scalekit token" }, { status: 401 });
  }

  if (!requirePermission(token, "field_data_entry")) {
    return NextResponse.json({ error: "Forbidden: Missing 'field_data_entry' permission" }, { status: 403 });
  }

  const body = await req.json();
  const { transcript } = body;

  if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
    return NextResponse.json({ error: "Missing or empty 'transcript' field" }, { status: 400 });
  }

  createAuditEntry("identity_auth", "AUTH_VALIDATE", `Paramedic token validated for ${token.name} (${token.userId}). Role: ${token.role}`, token.userId, token.name);

  const encounter = await runAgentPipeline(transcript, token.userId, token.name);
  upsertEncounter(encounter);

  return NextResponse.json({
    success: true,
    encounter,
    pipeline: {
      agentsExecuted: encounter.auditTrail.length,
      totalTimeMs: encounter.auditTrail.reduce((_, e) => {
        return Date.now() - new Date(e.timestamp).getTime();
      }, 0),
      safetyFlags: encounter.safetyFlags?.length ?? 0,
      status: encounter.status,
    },
  });
}
