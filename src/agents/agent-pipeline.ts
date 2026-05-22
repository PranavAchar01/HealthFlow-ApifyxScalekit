import { Encounter } from "@/types";
import { createAuditEntry } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";
// Sequential agents (extracted into standalone files for clarity)
import { agentVoiceCapture } from "./agent-voice-capture";
import { agentContextPull } from "./agent-context-pull";
import { agentCaseSupervisor } from "./agent-case-supervisor";
// LangChain-backed agents (each with a deterministic fallback)
import { runStructuringChain } from "./chains/structuring-chain";
import { runDiagnosisChain } from "./chains/diagnosis-chain";
import { runGuidelinesChain } from "./chains/guidelines-chain";
import { runActionPlannerChain } from "./chains/action-planner-chain";
import { runDrugAllergyCheck, runSafetyController } from "./chains/safety-chain";

/**
 * The full agent pipeline. Order:
 *   1   Voice Capture        (agent-voice-capture)
 *   2   Structuring          (chains/structuring-chain)
 *   2.5 Context Pull         (agent-context-pull)
 *   7a  Diagnosis            (chains/diagnosis-chain)
 *   7b  Guidelines           (chains/guidelines-chain)   <-- NEW
 *   7c  Action Planner       (chains/action-planner-chain)
 *   3   Drug/Allergy Check   (chains/safety-chain)
 *   8   Safety Controller    (chains/safety-chain)
 *   9   Case Supervisor      (agent-case-supervisor)
 *
 * Agents 4 (Identity/Auth), 5 (EHR Write), and 6 (Audit) run at commit time
 * in src/app/api/agents/commit/route.ts -- they require a physician token.
 */
export async function runAgentPipeline(
  rawText: string,
  paramedicId: string,
  paramedicName: string
): Promise<Encounter> {
  const encounterId = uuidv4();
  const now = new Date().toISOString();

  const encounter: Encounter = {
    id: encounterId,
    status: "field_capture",
    acuity: "medium",
    createdAt: now,
    updatedAt: now,
    paramedicId,
    paramedicName,
    rawTranscript: rawText,
    auditTrail: [],
  };

  // Agent 1: Voice capture
  const voiceResult = agentVoiceCapture(rawText, paramedicId, paramedicName);
  encounter.auditTrail.push(voiceResult.auditEntry);

  // Agent 2: Structuring (LangChain)
  encounter.status = "structuring";
  const structStart = Date.now();
  const structuredData = await runStructuringChain(rawText);
  encounter.structuredData = structuredData;
  const structAudit = createAuditEntry(
    "structuring",
    "STRUCTURE_LANGCHAIN",
    `LangChain structuring: chief complaint "${structuredData.chiefComplaint}", ${structuredData.observations.length} observations, ${structuredData.conditions.length} conditions`
  );
  encounter.auditTrail.push({ ...structAudit, processingTimeMs: Date.now() - structStart } as typeof structAudit);

  // Agent 2.5: Context pull
  encounter.status = "context_loaded";
  const contextResult = agentContextPull();
  encounter.patientContext = contextResult.data;
  encounter.auditTrail.push(contextResult.auditEntry);

  // Agent 7a: Diagnosis (LangChain)
  encounter.status = "diagnosis_complete";
  const diagStart = Date.now();
  const diagnosis = await runDiagnosisChain(encounter);
  encounter.diagnosis = diagnosis;
  const diagAudit = createAuditEntry(
    "diagnosis",
    "DIAGNOSE_LANGCHAIN",
    `LangChain diagnosis: ${diagnosis.primary} (confidence: ${(diagnosis.confidence * 100).toFixed(0)}%)`
  );
  encounter.auditTrail.push({ ...diagAudit, processingTimeMs: Date.now() - diagStart } as typeof diagAudit);

  // Agent 7b: Guidelines (LangChain) -- fetch evidence-based guidance for the Dx
  const guideStart = Date.now();
  const guidelines = await runGuidelinesChain(encounter);
  encounter.guidelines = guidelines;
  const guideAudit = createAuditEntry(
    "guidelines",
    "FETCH_GUIDELINES",
    `Guidelines retrieved: ${guidelines.source} -- ${guidelines.recommendations.length} recommendations, ${guidelines.redFlags.length} red flags. ${guidelines.summary}`
  );
  encounter.auditTrail.push({ ...guideAudit, processingTimeMs: Date.now() - guideStart } as typeof guideAudit);

  // Agent 7c: Action planner (LangChain) -- drafts orders informed by guidelines
  encounter.status = "order_drafted";
  const orderStart = Date.now();
  const draftOrders = await runActionPlannerChain(encounter);
  encounter.draftOrders = draftOrders;
  const orderAudit = createAuditEntry(
    "action_planner",
    "PLAN_ORDERS_LANGCHAIN",
    `LangChain action planner: drafted ${draftOrders.length} orders for ${diagnosis.primary}`
  );
  encounter.auditTrail.push({ ...orderAudit, processingTimeMs: Date.now() - orderStart } as typeof orderAudit);

  // Agent 3 + 8: Drug/allergy check (Apify) and safety controller
  if (encounter.draftOrders && encounter.patientContext) {
    encounter.status = "safety_flagged";
    const drugResult = runDrugAllergyCheck(encounter.draftOrders, encounter.patientContext);
    encounter.draftOrders = drugResult.orders;
    encounter.safetyFlags = drugResult.conflicts;
    const drugAudit = createAuditEntry(
      "drug_allergy_check",
      "SAFETY_SCAN",
      `Apify drug interaction check: ${drugResult.conflicts.length} conflicts found. ${drugResult.conflicts.filter((c) => c.severity === "contraindicated").length} contraindicated.`
    );
    encounter.auditTrail.push(drugAudit);

    const safetyResult = runSafetyController(drugResult.orders, drugResult.conflicts);
    encounter.draftOrders = safetyResult.orders;
    encounter.safetyRecommendation = safetyResult.recommendation;
    const safetyAudit = createAuditEntry("safety_controller", "SAFETY_DECISION", safetyResult.recommendation);
    encounter.auditTrail.push(safetyAudit);
  }

  // Agent 9: Case supervisor
  const caseResult = agentCaseSupervisor(encounter);
  encounter.acuity = caseResult.data?.acuity ?? "medium";
  encounter.auditTrail.push(caseResult.auditEntry);

  // Final status
  const hasBlocked = encounter.draftOrders?.some((o) => o.status === "blocked");
  encounter.status = hasBlocked ? "needs_doctor_approval" : "order_drafted";

  const finalAudit = createAuditEntry(
    "audit",
    "PIPELINE_COMPLETE",
    `Encounter ${encounterId} pipeline complete. Status: ${encounter.status}. Acuity: ${encounter.acuity}. ${encounter.draftOrders?.length ?? 0} orders, ${encounter.safetyFlags?.length ?? 0} safety flags. Engine: LangChain.`
  );
  encounter.auditTrail.push(finalAudit);

  return encounter;
}
