import { Encounter, AgentResult, PatientContext } from "@/types";
import { createAuditEntry } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";
import { runStructuringChain } from "./chains/structuring-chain";
import { runDiagnosisChain } from "./chains/diagnosis-chain";
import { runActionPlannerChain } from "./chains/action-planner-chain";
import { runDrugAllergyCheck, runSafetyController } from "./chains/safety-chain";

const MOCK_PATIENT_DB: Record<string, PatientContext> = {
  default: {
    patientId: "PT-20240001",
    name: "John Martinez",
    age: 68,
    sex: "Male",
    allergies: ["Penicillin"],
    currentMedications: ["Warfarin 5mg daily", "Lisinopril 10mg daily", "Metformin 500mg BID"],
    conditions: ["Atrial Fibrillation", "Hypertension", "Type 2 Diabetes"],
    recentLabs: {
      INR: "2.8 (therapeutic range 2.0-3.0)",
      glucose: "142 mg/dL",
      creatinine: "1.1 mg/dL",
    },
  },
};

function agentVoiceCapture(rawText: string, paramedicId: string, paramedicName: string): AgentResult<{ rawTranscript: string }> {
  const start = Date.now();
  const audit = createAuditEntry(
    "voice_capture", "TRANSCRIBE",
    `Paramedic ${paramedicName} (${paramedicId}) captured field transcript: ${rawText.substring(0, 100)}...`,
    paramedicId, paramedicName
  );
  return { agentRole: "voice_capture", success: true, data: { rawTranscript: rawText }, processingTimeMs: Date.now() - start, auditEntry: audit };
}

function agentContextPull(): AgentResult<PatientContext> {
  const start = Date.now();
  const patient = MOCK_PATIENT_DB.default;
  const audit = createAuditEntry("context_pull", "CONTEXT_PULL",
    `Retrieved patient context for ${patient.name} (${patient.patientId}). Current medications: ${patient.currentMedications.join(", ")}`);
  return { agentRole: "context_pull", success: true, data: patient, processingTimeMs: Date.now() - start, auditEntry: audit };
}

function agentCaseSupervisor(encounter: Encounter): AgentResult<{ acuity: Encounter["acuity"]; routeTo: string }> {
  const start = Date.now();
  const hasBlockedOrders = encounter.draftOrders?.some((o) => o.status === "blocked");
  const hasCriticalCondition = encounter.structuredData?.conditions.some((c) => c.severity === "severe");

  let acuity: Encounter["acuity"] = "medium";
  let routeTo = "general_queue";

  if (hasCriticalCondition || hasBlockedOrders) {
    acuity = "critical";
    routeTo = "crm_aggregate_ui";
  } else if (encounter.diagnosis && encounter.diagnosis.confidence > 0.7) {
    acuity = "high";
    routeTo = "crm_aggregate_ui";
  }

  const audit = createAuditEntry("case_supervisor", "ROUTE", `Case routed to ${routeTo} with acuity: ${acuity}`);
  return { agentRole: "case_supervisor", success: true, data: { acuity, routeTo }, processingTimeMs: Date.now() - start, auditEntry: audit };
}

export async function runAgentPipeline(
  rawText: string,
  paramedicId: string,
  paramedicName: string
): Promise<Encounter> {
  const encounterId = uuidv4();
  const now = new Date().toISOString();

  const encounter: Encounter = {
    id: encounterId, status: "field_capture", acuity: "medium",
    createdAt: now, updatedAt: now,
    paramedicId, paramedicName, rawTranscript: rawText, auditTrail: [],
  };

  // Agent 1: Voice capture
  const voiceResult = agentVoiceCapture(rawText, paramedicId, paramedicName);
  encounter.auditTrail.push(voiceResult.auditEntry);

  // Agent 2: Structuring (LangChain)
  encounter.status = "structuring";
  const structStart = Date.now();
  const structuredData = await runStructuringChain(rawText);
  encounter.structuredData = structuredData;
  const structAudit = createAuditEntry("structuring", "STRUCTURE_LANGCHAIN",
    `LangChain structuring: chief complaint "${structuredData.chiefComplaint}", ${structuredData.observations.length} observations, ${structuredData.conditions.length} conditions`);
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
  const diagAudit = createAuditEntry("diagnosis", "DIAGNOSE_LANGCHAIN",
    `LangChain diagnosis: ${diagnosis.primary} (confidence: ${(diagnosis.confidence * 100).toFixed(0)}%)`);
  encounter.auditTrail.push({ ...diagAudit, processingTimeMs: Date.now() - diagStart } as typeof diagAudit);

  // Agent 7c: Action planner (LangChain)
  encounter.status = "order_drafted";
  const orderStart = Date.now();
  const draftOrders = await runActionPlannerChain(encounter);
  encounter.draftOrders = draftOrders;
  const orderAudit = createAuditEntry("action_planner", "PLAN_ORDERS_LANGCHAIN",
    `LangChain action planner: drafted ${draftOrders.length} orders for ${diagnosis.primary}`);
  encounter.auditTrail.push({ ...orderAudit, processingTimeMs: Date.now() - orderStart } as typeof orderAudit);

  // Agent 3: Drug/allergy check (Apify simulation)
  if (encounter.draftOrders && encounter.patientContext) {
    encounter.status = "safety_flagged";
    const drugResult = runDrugAllergyCheck(encounter.draftOrders, encounter.patientContext);
    encounter.draftOrders = drugResult.orders;
    encounter.safetyFlags = drugResult.conflicts;
    const drugAudit = createAuditEntry("drug_allergy_check", "SAFETY_SCAN",
      `Apify drug interaction check: ${drugResult.conflicts.length} conflicts found. ${drugResult.conflicts.filter((c) => c.severity === "contraindicated").length} contraindicated.`);
    encounter.auditTrail.push(drugAudit);

    // Agent 8: Safety controller
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

  // Set final status
  const hasBlocked = encounter.draftOrders?.some((o) => o.status === "blocked");
  encounter.status = hasBlocked ? "needs_doctor_approval" : "order_drafted";

  // Final audit
  const finalAudit = createAuditEntry("audit", "PIPELINE_COMPLETE",
    `Encounter ${encounterId} pipeline complete. Status: ${encounter.status}. Acuity: ${encounter.acuity}. ${encounter.draftOrders?.length ?? 0} orders, ${encounter.safetyFlags?.length ?? 0} safety flags. Engine: LangChain.`);
  encounter.auditTrail.push(finalAudit);

  return encounter;
}
