import { NextRequest, NextResponse } from "next/server";
import { getEncounter, upsertEncounter } from "@/lib/store";
import { validateToken, requirePermission } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { corsHeaders, corsResponse } from "@/lib/cors";
import { runAggregateDiagnosis } from "@/agents/chains/aggregate-diagnosis-chain";
import { runDrugAllergyCheck, runSafetyController } from "@/agents/chains/safety-chain";
import { runActionPlannerChain } from "@/agents/chains/action-planner-chain";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const authHeader = req.headers.get("authorization");
  const token = validateToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
  }
  // Any clinical role (paramedic, nurse, physician) can request a re-aggregation.
  const allowed = requirePermission(token, "view_encounters") ||
                  requirePermission(token, "nursing_notes") ||
                  requirePermission(token, "field_data_entry") ||
                  requirePermission(token, "cpoe");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders(origin) });
  }

  const { id } = await params;
  const encounter = await getEncounter(id);
  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404, headers: corsHeaders(origin) });
  }

  // 1) Re-run aggregate diagnosis with ALL accumulated info
  const start = Date.now();
  const diagnosis = await runAggregateDiagnosis(encounter);
  encounter.diagnosis = diagnosis;
  encounter.auditTrail.push(
    createAuditEntry(
      "diagnosis", "REDIAGNOSE_AGGREGATE",
      `Aggregate re-diagnosis triggered by ${token.name} (${token.role}). Primary: ${diagnosis.primary} (conf ${(diagnosis.confidence * 100).toFixed(0)}%). Inputs: dispatch + transcript + ${encounter.nursingNotes?.length ?? 0} nursing note(s).`,
      token.userId, token.name
    )
  );

  // 2) Re-plan orders based on updated diagnosis
  try {
    const orders = await runActionPlannerChain(encounter);
    encounter.draftOrders = orders;
    encounter.auditTrail.push(
      createAuditEntry("action_planner", "REPLAN_ORDERS", `Replanned ${orders.length} orders against updated diagnosis.`)
    );
  } catch (err) {
    console.error("[rediagnose] replan failed:", err);
  }

  // 3) Re-run safety check on the new orders
  if (encounter.draftOrders && encounter.patientContext) {
    const drugResult = await runDrugAllergyCheck(encounter.draftOrders, encounter.patientContext);
    encounter.draftOrders = drugResult.orders;
    encounter.safetyFlags = drugResult.conflicts;
    const safetyResult = runSafetyController(drugResult.orders, drugResult.conflicts);
    encounter.draftOrders = safetyResult.orders;
    encounter.safetyRecommendation = safetyResult.recommendation;
    encounter.auditTrail.push(
      createAuditEntry("safety_controller", "SAFETY_RECHECK", `${drugResult.conflicts.length} conflicts after re-aggregation. ${safetyResult.recommendation}`)
    );
  }

  // 4) Persist + broadcast
  await upsertEncounter(encounter);

  return NextResponse.json({
    encounter,
    rediagnose: {
      triggeredBy: token.name,
      role: token.role,
      processingTimeMs: Date.now() - start,
      sources: {
        dispatch: !!encounter.patientContext,
        transcript: !!encounter.rawTranscript,
        nursingNotes: encounter.nursingNotes?.length ?? 0,
      },
    },
  }, { headers: corsHeaders(origin) });
}
