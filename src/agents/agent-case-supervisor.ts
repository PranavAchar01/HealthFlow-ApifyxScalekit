import { AgentResult, Encounter } from "@/types";
import { createAuditEntry } from "@/lib/audit";

/**
 * Agent 9 — Case Supervisor
 *
 * Rule-based acuity classification + routing. Blocked orders or severe
 * conditions escalate to critical and route to the aggregate CRM for
 * physician attention; high-confidence diagnoses route there too.
 */
export function agentCaseSupervisor(
  encounter: Encounter
): AgentResult<{ acuity: Encounter["acuity"]; routeTo: string }> {
  const start = Date.now();
  const hasBlockedOrders = encounter.draftOrders?.some((o) => o.status === "blocked");
  const hasCriticalCondition = encounter.structuredData?.conditions.some(
    (c) => c.severity === "severe"
  );

  let acuity: Encounter["acuity"] = "medium";
  let routeTo = "general_queue";

  if (hasCriticalCondition || hasBlockedOrders) {
    acuity = "critical";
    routeTo = "crm_aggregate_ui";
  } else if (encounter.diagnosis && encounter.diagnosis.confidence > 0.7) {
    acuity = "high";
    routeTo = "crm_aggregate_ui";
  }

  const audit = createAuditEntry(
    "case_supervisor",
    "ROUTE",
    `Case routed to ${routeTo} with acuity: ${acuity}`
  );
  return {
    agentRole: "case_supervisor",
    success: true,
    data: { acuity, routeTo },
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}
