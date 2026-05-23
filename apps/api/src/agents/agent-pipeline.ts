import { Encounter, AgentResult, PatientContext } from "@/types";
import { createAuditEntry } from "@/lib/audit";
import { upsertEncounter } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";
import { runStructuringChain } from "./chains/structuring-chain";
import { runDiagnosisChain } from "./chains/diagnosis-chain";
import { runActionPlannerChain } from "./chains/action-planner-chain";
import { runDrugAllergyCheck, runSafetyController } from "./chains/safety-chain";
import { runNurseAssessmentChain } from "./chains/nurse-assessment-chain";
import { runNurseCarePlanChain } from "./chains/nurse-care-plan-chain";

function extractPatientContext(transcript: string): PatientContext {
  const t = transcript;

  // Name: look for "patient [Name]", "[Age] year old [sex] [Name]", or "[Name], DOB"
  let name = "Unknown Patient";
  const namePatterns = [
    /patient\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /\d+\s+year\s+old\s+(?:male|female|man|woman)[,\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+),\s*DOB/,
    /name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+)/i,
  ];
  for (const p of namePatterns) {
    const m = t.match(p);
    if (m?.[1] && m[1].length > 3) { name = m[1].trim(); break; }
  }

  // Age
  let age: number | undefined;
  const ageM = t.match(/(\d+)\s*[-–]?\s*year[s]?\s*old/i) ?? t.match(/age[d]?\s*[:\s]*(\d+)/i);
  if (ageM) age = parseInt(ageM[1]);

  // Sex
  let sex: string | undefined;
  if (/\bfemale\b|\bwoman\b|\bgirl\b/i.test(t)) sex = "Female";
  else if (/\bmale\b|\bman\b|\bboy\b/i.test(t)) sex = "Male";

  // Patient ID / MRN
  let patientId = `PT-${Date.now().toString().slice(-6)}`;
  const mrnM = t.match(/(?:patient\s+id|mrn|patient\s+#)[:\s#]*([A-Z0-9-]+)/i);
  if (mrnM) patientId = mrnM[1];

  // Allergies: "allergies: X, Y" or "allergic to X"
  const allergies: string[] = [];
  const allergySect = t.match(/allergi(?:es|c\s+to)[:\s]+([^.]+)/i);
  if (allergySect) {
    allergySect[1].split(/,|and/i).forEach(a => {
      const cleaned = a.trim().replace(/\s+causes?.*/i, "").trim();
      if (cleaned.length > 1 && cleaned.toLowerCase() !== "no known") allergies.push(cleaned);
    });
  }
  if (allergies.length === 0) allergies.push("NKDA");

  // Medications
  const meds: string[] = [];
  const medSect = t.match(/(?:current\s+)?meds?(?:ications?)?[:\s]+([^.]+(?:\.[^.]+)?)/i);
  if (medSect) {
    medSect[1].split(/,/).forEach(m => {
      const cleaned = m.trim();
      if (cleaned.length > 2) meds.push(cleaned);
    });
  }

  // Conditions from history
  const conditions: string[] = [];
  const histSect = t.match(/history\s+of\s+([^.]+)/i);
  if (histSect) {
    histSect[1].split(/,|and/i).forEach(c => {
      const cleaned = c.trim();
      if (cleaned.length > 2) conditions.push(cleaned);
    });
  }

  return { patientId, name, age: age ?? 0, sex: sex ?? "Unknown", allergies, currentMedications: meds, conditions };
}

// When an encounter was seeded with rich preset data (911 dispatch), prefer that
// over the regex extraction — only backfill fields the preset left empty.
function mergeContext(existing: PatientContext | undefined, extracted: PatientContext | undefined): PatientContext | undefined {
  if (!extracted) return existing;
  if (!existing) return extracted;
  const realName = existing.name && existing.name !== "Unknown Patient" && !/^unknown/i.test(existing.name);
  const realAllergies = (existing.allergies ?? []).filter((a) => a && a.toUpperCase() !== "NKDA");
  return {
    patientId: existing.patientId || extracted.patientId,
    name: realName ? existing.name : extracted.name,
    age: existing.age || extracted.age,
    sex: existing.sex && existing.sex !== "Unknown" ? existing.sex : extracted.sex,
    allergies: realAllergies.length ? existing.allergies : extracted.allergies,
    currentMedications: (existing.currentMedications ?? []).length ? existing.currentMedications : extracted.currentMedications,
    conditions: (existing.conditions ?? []).length ? existing.conditions : extracted.conditions,
    recentLabs: existing.recentLabs ?? extracted.recentLabs,
  };
}

function agentVoiceCapture(rawText: string, paramedicId: string, paramedicName: string): AgentResult<{ rawTranscript: string }> {
  const start = Date.now();
  const audit = createAuditEntry(
    "voice_capture", "TRANSCRIBE",
    `Paramedic ${paramedicName} (${paramedicId}) captured field transcript: ${rawText.substring(0, 100)}...`,
    paramedicId, paramedicName
  );
  return { agentRole: "voice_capture", success: true, data: { rawTranscript: rawText }, processingTimeMs: Date.now() - start, auditEntry: audit };
}

function agentContextPull(rawTranscript: string): AgentResult<PatientContext> {
  const start = Date.now();
  const patient = extractPatientContext(rawTranscript);
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

// ── Stage 1: Live capture ──────────────────────────────────────────────────
// Transcript → structuring + patient context + diagnosis. Cheap enough to re-run
// repeatedly as a paramedic dictates, so nurse/doctor CRMs fill in live.
// recordAudit is false on rapid live ticks to avoid bloating the audit trail.
export async function runLiveCapture(
  encounter: Encounter,
  rawText: string,
  recordAudit = true
): Promise<Encounter> {
  encounter.rawTranscript = rawText;

  // Structuring (LangChain → LLM, regex fallback)
  encounter.status = "structuring";
  await upsertEncounter(encounter);
  const structStart = Date.now();
  encounter.structuredData = await runStructuringChain(rawText);
  if (recordAudit) {
    const structAudit = createAuditEntry("structuring", "STRUCTURE_LANGCHAIN",
      `LangChain structuring: chief complaint "${encounter.structuredData.chiefComplaint}", ${encounter.structuredData.observations.length} observations, ${encounter.structuredData.conditions.length} conditions`);
    encounter.auditTrail.push({ ...structAudit, processingTimeMs: Date.now() - structStart } as typeof structAudit);
  }
  await upsertEncounter(encounter);

  // Context pull — merge with any preset (911) data already present
  encounter.status = "context_loaded";
  const contextResult = agentContextPull(rawText);
  encounter.patientContext = mergeContext(encounter.patientContext, contextResult.data);
  if (recordAudit) encounter.auditTrail.push(contextResult.auditEntry);
  await upsertEncounter(encounter);

  // Diagnosis (the physician-facing read)
  encounter.status = "diagnosis_complete";
  const diagStart = Date.now();
  encounter.diagnosis = await runDiagnosisChain(encounter);
  if (recordAudit) {
    const diagAudit = createAuditEntry("diagnosis", "DIAGNOSE_LANGCHAIN",
      `LangChain diagnosis: ${encounter.diagnosis.primary} (confidence: ${(encounter.diagnosis.confidence * 100).toFixed(0)}%)`);
    encounter.auditTrail.push({ ...diagAudit, processingTimeMs: Date.now() - diagStart } as typeof diagAudit);
  }
  await upsertEncounter(encounter);

  return encounter;
}

// ── Stage 2: Downstream reasoning ──────────────────────────────────────────
// Orders → safety → acuity → nurse assessment → nurse care plan → final status.
// Runs once the captured data is "settled" (paramedic submits / 911 auto-run).
export async function runDownstream(encounter: Encounter): Promise<Encounter> {
  // Action planner (LangChain)
  encounter.status = "order_drafted";
  const orderStart = Date.now();
  const draftOrders = await runActionPlannerChain(encounter);
  encounter.draftOrders = draftOrders;
  const orderAudit = createAuditEntry("action_planner", "PLAN_ORDERS_LANGCHAIN",
    `LangChain action planner: drafted ${draftOrders.length} orders for ${encounter.diagnosis?.primary ?? "encounter"}`);
  encounter.auditTrail.push({ ...orderAudit, processingTimeMs: Date.now() - orderStart } as typeof orderAudit);
  await upsertEncounter(encounter);

  // Drug/allergy check + safety controller
  if (encounter.draftOrders && encounter.patientContext) {
    encounter.status = "safety_flagged";
    const drugResult = await runDrugAllergyCheck(encounter.draftOrders, encounter.patientContext);
    encounter.draftOrders = drugResult.orders;
    encounter.safetyFlags = drugResult.conflicts;
    const drugAudit = createAuditEntry("drug_allergy_check", "SAFETY_SCAN", drugResult.auditNote);
    encounter.auditTrail.push(drugAudit);

    const safetyResult = runSafetyController(drugResult.orders, drugResult.conflicts);
    encounter.draftOrders = safetyResult.orders;
    encounter.safetyRecommendation = safetyResult.recommendation;
    const safetyAudit = createAuditEntry("safety_controller", "SAFETY_DECISION", safetyResult.recommendation);
    encounter.auditTrail.push(safetyAudit);
    await upsertEncounter(encounter);
  }

  // Case supervisor (acuity)
  const caseResult = agentCaseSupervisor(encounter);
  encounter.acuity = caseResult.data?.acuity ?? "medium";
  encounter.auditTrail.push(caseResult.auditEntry);

  // Nurse assessment (AI triage)
  const nurseStart = Date.now();
  const nurseAssessment = await runNurseAssessmentChain(encounter);
  encounter.nurseAssessment = nurseAssessment;
  const nurseAudit = createAuditEntry("nurse_assessment", "NURSE_TRIAGE",
    `AI nurse assessment: ${nurseAssessment.acuity_level}, Room ${nurseAssessment.room_assignment}, Priority ${nurseAssessment.priority_rank}. ${nurseAssessment.specialist_consult_needed ? `Consult: ${nurseAssessment.specialist_consult_needed}.` : "No specialist consult."} ${nurseAssessment.equipment_requested.length} equipment items, ${nurseAssessment.follow_up_tests.length} follow-up tests.`);
  encounter.auditTrail.push({ ...nurseAudit, processingTimeMs: Date.now() - nurseStart } as typeof nurseAudit);
  await upsertEncounter(encounter);

  // Nurse care plan (AI nursing intervention steps — "how to treat as a nurse")
  const planStart = Date.now();
  const carePlan = await runNurseCarePlanChain(encounter);
  encounter.nursingCarePlan = carePlan;
  const planAudit = createAuditEntry("nurse_care_plan", "NURSE_CARE_PLAN",
    `AI nurse care plan: ${carePlan.steps.length} nursing intervention steps (${carePlan.engine}). ${carePlan.summary}`);
  encounter.auditTrail.push({ ...planAudit, processingTimeMs: Date.now() - planStart } as typeof planAudit);
  await upsertEncounter(encounter);

  // Final status
  const hasBlocked = encounter.draftOrders?.some((o) => o.status === "blocked");
  encounter.status = hasBlocked ? "needs_doctor_approval" : "order_drafted";
  const finalAudit = createAuditEntry("audit", "PIPELINE_COMPLETE",
    `Encounter ${encounter.id} pipeline complete. Status: ${encounter.status}. Acuity: ${encounter.acuity}. ${encounter.draftOrders?.length ?? 0} orders, ${encounter.safetyFlags?.length ?? 0} safety flags. Engine: LangChain.`);
  encounter.auditTrail.push(finalAudit);
  await upsertEncounter(encounter);

  return encounter;
}

// Full progressive pipeline over an existing encounter (used by 911 seed auto-run).
export async function runProgressivePipeline(encounter: Encounter): Promise<Encounter> {
  await runLiveCapture(encounter, encounter.rawTranscript, true);
  return runDownstream(encounter);
}

// Entry point for the paramedic draft route — creates a fresh encounter then runs all stages.
export async function runAgentPipeline(
  rawText: string,
  paramedicId: string,
  paramedicName: string,
  opts?: { patientContext?: PatientContext }
): Promise<Encounter> {
  const encounterId = uuidv4();
  const now = new Date().toISOString();

  const encounter: Encounter = {
    id: encounterId, status: "field_capture", acuity: "medium",
    createdAt: now, updatedAt: now,
    paramedicId, paramedicName, rawTranscript: rawText, auditTrail: [],
    triageStatus: "pending", nursingNotes: [],
    // Seed patient context from dispatch (911) if provided
    patientContext: opts?.patientContext,
  };

  // Agent 1: Voice capture — publish immediately so the card appears in queues.
  const voiceResult = agentVoiceCapture(rawText, paramedicId, paramedicName);
  encounter.auditTrail.push(voiceResult.auditEntry);
  await upsertEncounter(encounter);

  await runLiveCapture(encounter, rawText, true);
  return runDownstream(encounter);
}
