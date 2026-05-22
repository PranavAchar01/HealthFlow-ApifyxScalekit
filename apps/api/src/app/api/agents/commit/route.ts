import { NextRequest, NextResponse } from "next/server";
import { validateToken, requirePermission } from "@/lib/auth";
import { getEncounter, upsertEncounter } from "@/lib/store";
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

  if (!requirePermission(token, "cpoe") || !requirePermission(token, "approve_orders")) {
    return NextResponse.json(
      { error: "Forbidden: Requires 'cpoe' and 'approve_orders' permissions (Attending Physician)" },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

  const body = await req.json();
  const { encounterId, approvedOrderIds } = body;

  if (!encounterId) {
    return NextResponse.json({ error: "Missing 'encounterId'" }, { status: 400, headers: corsHeaders(origin) });
  }

  const encounter = getEncounter(encounterId);
  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404, headers: corsHeaders(origin) });
  }

  if (encounter.status === "committed") {
    return NextResponse.json({ error: "Encounter already committed" }, { status: 409, headers: corsHeaders(origin) });
  }

  createAuditEntry(
    "identity_auth", "PHYSICIAN_AUTH",
    `Physician ${token.name} (${token.userId}) verified with CPOE rights. Approving encounter ${encounterId}`,
    token.userId, token.name
  );

  const idsToApprove: string[] = approvedOrderIds ?? encounter.draftOrders
    ?.filter((o) => o.status !== "blocked")
    .map((o) => o.id) ?? [];

  if (encounter.draftOrders) {
    for (const order of encounter.draftOrders) {
      if (idsToApprove.includes(order.id)) {
        order.status = "approved";
        if (order.medication) order.medication.status = "active";
      }
    }
  }

  encounter.approvedBy = token.userId;
  encounter.approvedAt = new Date().toISOString();
  encounter.physicianName = token.name;
  encounter.status = "approved";

  const ehrAudit = createAuditEntry("ehr_write", "EHR_COMMIT",
    `Orders committed to EHR under ${token.name}'s authority. ${idsToApprove.length} orders activated. Encounter ${encounterId} finalized.`,
    token.userId, token.name);
  encounter.auditTrail.push(ehrAudit);
  encounter.status = "committed";

  const finalAudit = createAuditEntry("audit", "IMMUTABLE_CHECKPOINT",
    `ENTIRE.IO AUDIT: Full lifecycle recorded. Input: ${encounter.paramedicName}. Safety: ${encounter.safetyFlags?.length ?? 0} flags. Approval: ${token.name}. Commit: EHR write successful.`,
    token.userId, token.name);
  encounter.auditTrail.push(finalAudit);

  upsertEncounter(encounter);

  return NextResponse.json({
    success: true, encounter,
    ehrCommit: { physicianId: token.userId, physicianName: token.name, ordersApproved: idsToApprove.length, timestamp: encounter.approvedAt, auditChecksum: finalAudit.checksum },
  }, { headers: corsHeaders(origin) });
}
