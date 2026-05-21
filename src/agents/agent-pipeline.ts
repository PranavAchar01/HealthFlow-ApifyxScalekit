import { Encounter, AgentResult, AuditEntry, DrugConflict, DraftOrder, DiagnosisResult, PatientContext, Vitals, FHIRObservation, FHIRCondition } from "@/types";
import { createAuditEntry } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";

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

const DRUG_INTERACTIONS: DrugConflict[] = [
  {
    drug: "tPA",
    conflictsWith: "Warfarin",
    severity: "contraindicated",
    description: "Administering tPA to a patient on Warfarin (INR 2.8) carries extreme risk of fatal intracranial hemorrhage. The anticoagulated state dramatically increases bleeding complications.",
    alternative: "Emergency mechanical thrombectomy",
  },
  {
    drug: "Aspirin",
    conflictsWith: "Warfarin",
    severity: "critical",
    description: "Dual anticoagulation/antiplatelet therapy significantly increases bleeding risk.",
    alternative: "Consult hematology before combining",
  },
  {
    drug: "Ibuprofen",
    conflictsWith: "Warfarin",
    severity: "warning",
    description: "NSAIDs may increase INR and bleeding risk with Warfarin.",
    alternative: "Acetaminophen for pain management",
  },
];

// Agent 1: Voice Capture (happens client-side, this just validates)
export function agentVoiceCapture(
  rawText: string,
  paramedicId: string,
  paramedicName: string
): AgentResult<{ rawTranscript: string }> {
  const start = Date.now();
  const audit = createAuditEntry(
    "voice_capture",
    "TRANSCRIBE",
    `Paramedic ${paramedicName} (${paramedicId}) captured field transcript: ${rawText.substring(0, 100)}...`,
    paramedicId,
    paramedicName
  );

  return {
    agentRole: "voice_capture",
    success: true,
    data: { rawTranscript: rawText },
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Agent 2: Structuring
export function agentStructuring(rawText: string): AgentResult<Encounter["structuredData"]> {
  const start = Date.now();
  const text = rawText.toLowerCase();

  const vitals: Vitals = {};
  const observations: FHIRObservation[] = [];
  const conditions: FHIRCondition[] = [];
  let chiefComplaint = "Undetermined";
  const now = new Date().toISOString();

  // Parse vitals from text
  const hrMatch = text.match(/(?:heart rate|hr|pulse)[:\s]*(\d+)/);
  if (hrMatch) {
    vitals.heartRate = parseInt(hrMatch[1]);
    observations.push({ resourceType: "Observation", code: "8867-4", display: "Heart Rate", value: vitals.heartRate, unit: "bpm", timestamp: now });
  }

  const bpMatch = text.match(/(?:blood pressure|bp)[:\s]*(\d+\/\d+)/);
  if (bpMatch) {
    vitals.bloodPressure = bpMatch[1];
    observations.push({ resourceType: "Observation", code: "85354-9", display: "Blood Pressure", value: vitals.bloodPressure, unit: "mmHg", timestamp: now });
  }

  const spo2Match = text.match(/(?:spo2|sp02|oxygen|o2 sat)[:\s]*(\d+)/);
  if (spo2Match) {
    vitals.spO2 = parseInt(spo2Match[1]);
    observations.push({ resourceType: "Observation", code: "2708-6", display: "SpO2", value: vitals.spO2, unit: "%", timestamp: now });
  }

  const tempMatch = text.match(/(?:temp|temperature)[:\s]*([\d.]+)/);
  if (tempMatch) {
    vitals.temperature = parseFloat(tempMatch[1]);
    observations.push({ resourceType: "Observation", code: "8310-5", display: "Temperature", value: vitals.temperature, unit: "°F", timestamp: now });
  }

  const rrMatch = text.match(/(?:respiratory rate|rr|resp)[:\s]*(\d+)/);
  if (rrMatch) {
    vitals.respiratoryRate = parseInt(rrMatch[1]);
    observations.push({ resourceType: "Observation", code: "9279-1", display: "Respiratory Rate", value: vitals.respiratoryRate, unit: "/min", timestamp: now });
  }

  const gcsMatch = text.match(/(?:gcs|glasgow)[:\s]*(\d+)/);
  if (gcsMatch) {
    vitals.gcs = parseInt(gcsMatch[1]);
    observations.push({ resourceType: "Observation", code: "9269-2", display: "GCS", value: vitals.gcs, unit: "", timestamp: now });
  }

  // Detect conditions
  if (text.includes("stroke") || text.includes("paralysis") || text.includes("facial droop") || text.includes("slurred speech")) {
    chiefComplaint = "Suspected Stroke";
    conditions.push({ resourceType: "Condition", code: "I63.9", display: "Cerebral Infarction (Ischemic Stroke)", severity: "severe", onsetDateTime: now });
  } else if (text.includes("chest pain") || text.includes("mi") || text.includes("heart attack")) {
    chiefComplaint = "Chest Pain / Suspected MI";
    conditions.push({ resourceType: "Condition", code: "I21.9", display: "Acute Myocardial Infarction", severity: "severe", onsetDateTime: now });
  } else if (text.includes("trauma") || text.includes("accident") || text.includes("injury")) {
    chiefComplaint = "Trauma";
    conditions.push({ resourceType: "Condition", code: "T07", display: "Multiple Injuries", severity: "moderate", onsetDateTime: now });
  } else if (text.includes("breathing") || text.includes("dyspnea") || text.includes("shortness of breath")) {
    chiefComplaint = "Respiratory Distress";
    conditions.push({ resourceType: "Condition", code: "R06.0", display: "Dyspnea", severity: "moderate", onsetDateTime: now });
  } else if (text.includes("seizure") || text.includes("convulsion")) {
    chiefComplaint = "Seizure";
    conditions.push({ resourceType: "Condition", code: "R56.9", display: "Seizure", severity: "moderate", onsetDateTime: now });
  }

  if (text.includes("left") && (text.includes("paralysis") || text.includes("weakness") || text.includes("hemiparesis"))) {
    observations.push({ resourceType: "Observation", code: "G81.9", display: "Left-sided Hemiparesis", value: "Present", timestamp: now });
  }

  if (text.includes("onset")) {
    const onsetMatch = text.match(/onset[:\s]*(\d+)\s*(minutes?|mins?|hours?|hrs?)\s*ago/);
    if (onsetMatch) {
      observations.push({ resourceType: "Observation", code: "ONSET", display: "Symptom Onset", value: `${onsetMatch[1]} ${onsetMatch[2]} ago`, timestamp: now });
    }
  }

  const structured: Encounter["structuredData"] = {
    chiefComplaint,
    vitals,
    observations,
    conditions,
    narrative: rawText,
  };

  const audit = createAuditEntry("structuring", "STRUCTURE", `Structured field data: chief complaint "${chiefComplaint}", ${observations.length} observations, ${conditions.length} conditions`);

  return {
    agentRole: "structuring",
    success: true,
    data: structured,
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Agent 2.5: Context Pull
export function agentContextPull(): AgentResult<PatientContext> {
  const start = Date.now();
  const patient = MOCK_PATIENT_DB.default;
  const audit = createAuditEntry("context_pull", "CONTEXT_PULL", `Retrieved patient context for ${patient.name} (${patient.patientId}). Current medications: ${patient.currentMedications.join(", ")}`);

  return {
    agentRole: "context_pull",
    success: true,
    data: patient,
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Agent 7a: Diagnosis
export function agentDiagnosis(encounter: Encounter): AgentResult<DiagnosisResult> {
  const start = Date.now();
  const conditions = encounter.structuredData?.conditions ?? [];
  const chiefComplaint = encounter.structuredData?.chiefComplaint ?? "";

  let diagnosis: DiagnosisResult;

  if (chiefComplaint.includes("Stroke") || conditions.some((c) => c.code === "I63.9")) {
    diagnosis = {
      primary: "Ischemic Stroke (Large Vessel Occlusion)",
      icdCode: "I63.9",
      confidence: 0.89,
      differentials: [
        { condition: "Hemorrhagic Stroke", probability: 0.08 },
        { condition: "TIA (Transient Ischemic Attack)", probability: 0.02 },
        { condition: "Todd's Paralysis post-seizure", probability: 0.01 },
      ],
      reasoning: "Left-side hemiparesis with acute onset in elderly patient with atrial fibrillation history strongly suggests cardioembolic ischemic stroke. NIHSS assessment and emergent CT/CTA recommended.",
    };
  } else if (chiefComplaint.includes("MI") || chiefComplaint.includes("Chest Pain")) {
    diagnosis = {
      primary: "ST-Elevation Myocardial Infarction (STEMI)",
      icdCode: "I21.3",
      confidence: 0.82,
      differentials: [
        { condition: "NSTEMI", probability: 0.10 },
        { condition: "Pulmonary Embolism", probability: 0.05 },
        { condition: "Aortic Dissection", probability: 0.03 },
      ],
      reasoning: "Acute chest pain with cardiac history warrants immediate 12-lead ECG and troponin levels.",
    };
  } else {
    diagnosis = {
      primary: chiefComplaint || "Undetermined - Requires Further Workup",
      icdCode: "R69",
      confidence: 0.5,
      differentials: [{ condition: "Multiple possible etiologies", probability: 0.5 }],
      reasoning: "Insufficient data for high-confidence diagnosis. Recommend comprehensive workup.",
    };
  }

  const audit = createAuditEntry("diagnosis", "DIAGNOSE", `Primary diagnosis: ${diagnosis.primary} (confidence: ${(diagnosis.confidence * 100).toFixed(0)}%)`);

  return {
    agentRole: "diagnosis",
    success: true,
    data: diagnosis,
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Agent 7c: Action Planner
export function agentActionPlanner(encounter: Encounter): AgentResult<DraftOrder[]> {
  const start = Date.now();
  const diagnosis = encounter.diagnosis;
  const orders: DraftOrder[] = [];

  if (diagnosis?.primary.includes("Stroke")) {
    orders.push(
      {
        id: uuidv4(),
        type: "medication",
        description: "Alteplase (tPA) IV bolus + infusion",
        urgency: "stat",
        medication: {
          resourceType: "MedicationRequest",
          medication: "tPA (Alteplase)",
          dosage: "0.9 mg/kg IV, max 90mg, 10% bolus over 1 min, remainder over 60 min",
          route: "IV",
          status: "draft",
        },
        status: "drafted",
      },
      {
        id: uuidv4(),
        type: "imaging",
        description: "CT Angiogram Head and Neck - STAT",
        urgency: "stat",
        status: "drafted",
      },
      {
        id: uuidv4(),
        type: "consult",
        description: "Activate Stroke Team - Code Stroke",
        urgency: "stat",
        status: "drafted",
      },
      {
        id: uuidv4(),
        type: "lab",
        description: "STAT: CBC, BMP, PT/INR, Troponin, Type & Screen",
        urgency: "stat",
        status: "drafted",
      }
    );
  } else if (diagnosis?.primary.includes("MI") || diagnosis?.primary.includes("STEMI")) {
    orders.push(
      {
        id: uuidv4(),
        type: "medication",
        description: "Aspirin 325mg PO STAT",
        urgency: "stat",
        medication: {
          resourceType: "MedicationRequest",
          medication: "Aspirin",
          dosage: "325mg PO",
          route: "PO",
          status: "draft",
        },
        status: "drafted",
      },
      {
        id: uuidv4(),
        type: "procedure",
        description: "12-Lead ECG STAT",
        urgency: "stat",
        status: "drafted",
      },
      {
        id: uuidv4(),
        type: "consult",
        description: "Activate Cardiac Catheterization Lab",
        urgency: "stat",
        status: "drafted",
      }
    );
  }

  const audit = createAuditEntry("action_planner", "PLAN_ORDERS", `Drafted ${orders.length} orders for ${diagnosis?.primary ?? "unknown"}`);

  return {
    agentRole: "action_planner",
    success: true,
    data: orders,
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Agent 3: Drug/Allergy Check (simulates Apify actor)
export function agentDrugAllergyCheck(
  orders: DraftOrder[],
  patientContext: PatientContext
): AgentResult<{ orders: DraftOrder[]; conflicts: DrugConflict[] }> {
  const start = Date.now();
  const conflicts: DrugConflict[] = [];

  for (const order of orders) {
    if (!order.medication) continue;

    for (const interaction of DRUG_INTERACTIONS) {
      const orderDrug = order.medication.medication.toLowerCase();
      const currentMeds = patientContext.currentMedications.map((m) => m.toLowerCase());

      if (
        orderDrug.includes(interaction.drug.toLowerCase()) &&
        currentMeds.some((m) => m.includes(interaction.conflictsWith.toLowerCase()))
      ) {
        conflicts.push(interaction);
        order.conflicts = [...(order.conflicts ?? []), interaction];

        if (interaction.severity === "contraindicated") {
          order.status = "blocked";
          order.medication.status = "blocked";
          order.medication.contraindication = interaction.description;
          order.safetyNotes = `BLOCKED: ${interaction.description}`;
          order.alternative = interaction.alternative;
        }
      }
    }

    for (const allergy of patientContext.allergies) {
      if (order.medication.medication.toLowerCase().includes(allergy.toLowerCase())) {
        const allergyConflict: DrugConflict = {
          drug: order.medication.medication,
          conflictsWith: `Patient Allergy: ${allergy}`,
          severity: "contraindicated",
          description: `Patient has documented allergy to ${allergy}`,
        };
        conflicts.push(allergyConflict);
        order.status = "blocked";
        order.medication.status = "blocked";
      }
    }
  }

  const audit = createAuditEntry(
    "drug_allergy_check",
    "SAFETY_SCAN",
    `Apify drug interaction check: ${conflicts.length} conflicts found. ${conflicts.filter((c) => c.severity === "contraindicated").length} contraindicated.`
  );

  return {
    agentRole: "drug_allergy_check",
    success: true,
    data: { orders, conflicts },
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Agent 8: Safety Controller
export function agentSafetyController(
  orders: DraftOrder[],
  conflicts: DrugConflict[]
): AgentResult<{ orders: DraftOrder[]; recommendation: string }> {
  const start = Date.now();
  const hasContraindicated = conflicts.some((c) => c.severity === "contraindicated");

  let recommendation: string;

  if (hasContraindicated) {
    const blocked = orders.filter((o) => o.status === "blocked");
    const alternatives = blocked
      .filter((o) => o.alternative)
      .map((o) => o.alternative)
      .join("; ");

    recommendation = `SAFETY HOLD: ${blocked.length} order(s) blocked due to contraindications. Recommended alternatives: ${alternatives || "Consult specialist"}. Requires physician review.`;

    for (const order of orders) {
      if (order.status === "blocked" && order.alternative) {
        orders.push({
          id: uuidv4(),
          type: "procedure",
          description: order.alternative,
          urgency: "stat",
          status: "drafted",
          safetyNotes: `Alternative to blocked ${order.description}`,
        });
      }
    }
  } else if (conflicts.length > 0) {
    recommendation = `WARNING: ${conflicts.length} drug interaction(s) flagged. Review recommended before execution.`;
  } else {
    recommendation = "All orders cleared safety checks. Ready for physician approval.";
  }

  const audit = createAuditEntry("safety_controller", "SAFETY_DECISION", recommendation);

  return {
    agentRole: "safety_controller",
    success: true,
    data: { orders, recommendation },
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Agent 9: Case Supervisor
export function agentCaseSupervisor(encounter: Encounter): AgentResult<{ acuity: Encounter["acuity"]; routeTo: string }> {
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

  return {
    agentRole: "case_supervisor",
    success: true,
    data: { acuity, routeTo },
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}

// Full pipeline orchestrator
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

  // Agent 2: Structuring
  encounter.status = "structuring";
  const structResult = agentStructuring(rawText);
  encounter.structuredData = structResult.data;
  encounter.auditTrail.push(structResult.auditEntry);

  // Agent 2.5: Context pull
  encounter.status = "context_loaded";
  const contextResult = agentContextPull();
  encounter.patientContext = contextResult.data;
  encounter.auditTrail.push(contextResult.auditEntry);

  // Agent 7a: Diagnosis
  encounter.status = "diagnosis_complete";
  const diagResult = agentDiagnosis(encounter);
  encounter.diagnosis = diagResult.data;
  encounter.auditTrail.push(diagResult.auditEntry);

  // Agent 7c: Action planner
  encounter.status = "order_drafted";
  const orderResult = agentActionPlanner(encounter);
  encounter.draftOrders = orderResult.data;
  encounter.auditTrail.push(orderResult.auditEntry);

  // Agent 3: Drug/allergy check
  if (encounter.draftOrders && encounter.patientContext) {
    encounter.status = "safety_flagged";
    const drugResult = agentDrugAllergyCheck(encounter.draftOrders, encounter.patientContext);
    encounter.draftOrders = drugResult.data?.orders;
    encounter.safetyFlags = drugResult.data?.conflicts;
    encounter.auditTrail.push(drugResult.auditEntry);

    // Agent 8: Safety controller
    if (drugResult.data) {
      const safetyResult = agentSafetyController(drugResult.data.orders, drugResult.data.conflicts);
      encounter.draftOrders = safetyResult.data?.orders;
      encounter.safetyRecommendation = safetyResult.data?.recommendation;
      encounter.auditTrail.push(safetyResult.auditEntry);
    }
  }

  // Agent 9: Case supervisor
  const caseResult = agentCaseSupervisor(encounter);
  encounter.acuity = caseResult.data?.acuity ?? "medium";
  encounter.auditTrail.push(caseResult.auditEntry);

  // Set final status
  const hasBlocked = encounter.draftOrders?.some((o) => o.status === "blocked");
  encounter.status = hasBlocked ? "needs_doctor_approval" : "order_drafted";

  // Final audit
  const finalAudit = createAuditEntry(
    "audit",
    "PIPELINE_COMPLETE",
    `Encounter ${encounterId} pipeline complete. Status: ${encounter.status}. Acuity: ${encounter.acuity}. ${encounter.draftOrders?.length ?? 0} orders, ${encounter.safetyFlags?.length ?? 0} safety flags.`
  );
  encounter.auditTrail.push(finalAudit);

  return encounter;
}
