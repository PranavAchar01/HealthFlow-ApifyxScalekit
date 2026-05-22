import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { NurseAssessment, Encounter } from "@/types";

const NURSE_ASSESSMENT_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an ED triage nurse AI agent. Given a patient encounter with vitals, diagnosis, and safety data,
generate a comprehensive nursing assessment for the incoming patient.
Output valid JSON with this exact schema:
{{
  "intake_notes": "string — concise clinical intake summary",
  "priority_rank": 1-5,
  "room_assignment": "string — e.g. Trauma Bay 1, Room 4, Resus A",
  "bed_assignment": "string — e.g. Bed 2A, Gurney 7",
  "acuity_level": "ESI-1|ESI-2|ESI-3|ESI-4|ESI-5",
  "equipment_requested": ["array of equipment/supplies needed"],
  "triage_category": "string — e.g. Emergent, Urgent, Semi-Urgent, Non-Urgent",
  "estimated_wait_time": "string — e.g. Immediate, 5 min, 15 min",
  "follow_up_tests": ["array of tests to order on arrival"],
  "specialist_consult_needed": "string or null — specialty name if needed",
  "isolation_required": true/false,
  "nurse_observations": "string — initial nursing observations",
  "patient_arrival_status": "ambulance|walk-in|transfer|helicopter",
  "family_notifications": "string — family contact status/instructions",
  "override_flag": true/false,
  "handoff_to_doctor": "string — structured handoff summary for attending physician"
}}
Use ESI (Emergency Severity Index): ESI-1 = resuscitation, ESI-2 = emergent, ESI-3 = urgent, ESI-4 = less urgent, ESI-5 = non-urgent.
Be clinically precise. Match room assignments to acuity (critical → Trauma Bay / Resus, high → monitored room, etc).`,
  ],
  [
    "human",
    `Chief Complaint: {chiefComplaint}
Vitals: {vitals}
Diagnosis: {diagnosis} (confidence: {confidence})
Differentials: {differentials}
Patient: {age}yo {sex}, Medications: {medications}, Allergies: {allergies}, Conditions: {existingConditions}
Safety Flags: {safetyFlags}
Field Transcript: {transcript}
Draft Orders: {orders}`,
  ],
]);

function createNurseAssessmentChain() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-key") return null;

  const model = new ChatAnthropic({
    modelName: "claude-sonnet-4-20250514",
    anthropicApiKey: apiKey,
    temperature: 0,
    maxTokens: 2000,
  });

  return RunnableSequence.from([NURSE_ASSESSMENT_PROMPT, model, new StringOutputParser()]);
}

function fallbackNurseAssessment(encounter: Encounter): NurseAssessment {
  const diagnosis = encounter.diagnosis?.primary ?? "";
  const acuity = encounter.acuity;
  const hasBlocked = encounter.draftOrders?.some((o) => o.status === "blocked");
  const hasSafetyFlags = (encounter.safetyFlags?.length ?? 0) > 0;
  const vitals = encounter.structuredData?.vitals;
  const chiefComplaint = encounter.structuredData?.chiefComplaint ?? "Undetermined";
  const patient = encounter.patientContext;

  let acuityLevel: NurseAssessment["acuity_level"] = "ESI-3";
  let priorityRank = 3;
  let roomAssignment = "Room 8";
  let bedAssignment = "Bed 8A";
  let triageCategory = "Urgent";
  let estimatedWaitTime = "15 min";
  let specialistConsult: string | null = null;
  let isolationRequired = false;

  if (acuity === "critical" || diagnosis.includes("Stroke") || diagnosis.includes("STEMI")) {
    acuityLevel = "ESI-1";
    priorityRank = 1;
    triageCategory = "Emergent — Immediate";
    estimatedWaitTime = "Immediate";
  } else if (acuity === "high") {
    acuityLevel = "ESI-2";
    priorityRank = 2;
    triageCategory = "Emergent";
    estimatedWaitTime = "5 min";
  } else if (acuity === "medium") {
    acuityLevel = "ESI-3";
    priorityRank = 3;
    triageCategory = "Urgent";
    estimatedWaitTime = "15 min";
  } else {
    acuityLevel = "ESI-4";
    priorityRank = 4;
    triageCategory = "Semi-Urgent";
    estimatedWaitTime = "30 min";
  }

  const equipmentRequested: string[] = [];
  const followUpTests: string[] = [];

  if (diagnosis.includes("Stroke")) {
    roomAssignment = "Resus A";
    bedAssignment = "Resus Bed 1";
    specialistConsult = "Neurology — Stroke Team";
    equipmentRequested.push("Cardiac monitor", "IV pump (2x)", "CT scanner reserved", "tPA kit on standby", "Foley catheter tray");
    followUpTests.push("STAT CT Head", "CT Angiogram", "CBC", "BMP", "PT/INR", "Troponin", "Type & Screen", "EKG");
  } else if (diagnosis.includes("STEMI") || diagnosis.includes("MI") || diagnosis.includes("Myocardial")) {
    roomAssignment = "Resus B";
    bedAssignment = "Resus Bed 2";
    specialistConsult = "Cardiology — Cath Lab";
    equipmentRequested.push("Cardiac monitor", "Defibrillator on standby", "12-Lead ECG", "IV pump", "Crash cart nearby");
    followUpTests.push("STAT 12-Lead ECG", "Troponin", "CBC", "BMP", "PT/INR", "CXR portable", "Type & Screen");
  } else if (diagnosis.includes("Trauma") || chiefComplaint.includes("Trauma")) {
    roomAssignment = "Trauma Bay 1";
    bedAssignment = "Trauma Bed 1";
    specialistConsult = "Trauma Surgery";
    equipmentRequested.push("Trauma board", "C-collar", "IV pump (2x)", "Blood warmer", "Portable X-ray");
    followUpTests.push("FAST Ultrasound", "CT Chest/Abdomen/Pelvis", "CBC", "BMP", "Type & Cross 4 units", "Lactate");
  } else if (diagnosis.includes("Respiratory") || chiefComplaint.includes("Respiratory")) {
    roomAssignment = "Room 3 — Monitored";
    bedAssignment = "Bed 3A";
    specialistConsult = "Pulmonology";
    equipmentRequested.push("BiPAP/CPAP", "Cardiac monitor", "Suction equipment", "Nebulizer");
    followUpTests.push("ABG", "CXR", "CBC", "BMP", "BNP", "Procalcitonin");
  } else if (diagnosis.includes("Diabetic") || diagnosis.includes("Hypoglycemia")) {
    roomAssignment = "Room 5 — Monitored";
    bedAssignment = "Bed 5B";
    specialistConsult = "Endocrinology";
    equipmentRequested.push("Cardiac monitor", "Glucometer", "IV pump", "D50 on standby");
    followUpTests.push("Point-of-care glucose q15min", "HbA1c", "BMP", "CBC", "Insulin level");
  } else {
    equipmentRequested.push("Cardiac monitor", "IV pump", "Pulse oximeter");
    followUpTests.push("CBC", "BMP", "Urinalysis");
  }

  const vitalsStr = vitals
    ? [
        vitals.heartRate ? `HR ${vitals.heartRate}` : null,
        vitals.bloodPressure ? `BP ${vitals.bloodPressure}` : null,
        vitals.spO2 ? `SpO2 ${vitals.spO2}%` : null,
        vitals.gcs ? `GCS ${vitals.gcs}` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "Vitals pending";

  const intakeNotes = `${patient?.age ?? "Unknown"}yo ${patient?.sex ?? ""} arriving via ambulance with ${chiefComplaint}. Field vitals: ${vitalsStr}. ${
    hasSafetyFlags ? `ALERT: ${encounter.safetyFlags!.length} drug interaction(s) flagged — review before medication administration.` : ""
  } ${hasBlocked ? "Blocked orders present — physician review required before proceeding." : ""}`.trim();

  const nurseObservations = `Patient transported via EMS from field. ${chiefComplaint} per paramedic report (${encounter.paramedicName}). ${
    vitals?.gcs && vitals.gcs < 15
      ? `Altered mental status noted (GCS ${vitals.gcs}).`
      : "Patient alert and responsive."
  } ${
    vitals?.spO2 && vitals.spO2 < 94
      ? `Hypoxia noted (SpO2 ${vitals.spO2}%) — supplemental O2 initiated.`
      : ""
  } ${
    patient?.allergies.length
      ? `Allergy band placed: ${patient.allergies.join(", ")}.`
      : "No known allergies — green band applied."
  }`.trim();

  const handoffToDr = `SBAR Handoff — ${patient?.name ?? "Unknown Patient"}, ${patient?.age ?? "?"}yo ${patient?.sex ?? ""}. ` +
    `Situation: ${chiefComplaint}, arrival via ambulance. ` +
    `Background: ${patient?.conditions.length ? patient.conditions.join(", ") : "No significant PMH"}. Meds: ${patient?.currentMedications.length ? patient.currentMedications.join(", ") : "None"}. ` +
    `Assessment: AI Dx ${diagnosis} (${encounter.diagnosis ? (encounter.diagnosis.confidence * 100).toFixed(0) : "?"}% confidence). ${vitalsStr}. ${hasSafetyFlags ? `${encounter.safetyFlags!.length} safety flag(s) — review contraindications.` : "No safety flags."} ` +
    `Recommendation: ${encounter.draftOrders?.length ?? 0} draft orders pending approval. ${specialistConsult ? `${specialistConsult} consulted.` : ""}`;

  return {
    intake_notes: intakeNotes,
    priority_rank: priorityRank,
    room_assignment: roomAssignment,
    bed_assignment: bedAssignment,
    acuity_level: acuityLevel,
    equipment_requested: equipmentRequested,
    triage_category: triageCategory,
    estimated_wait_time: estimatedWaitTime,
    follow_up_tests: followUpTests,
    specialist_consult_needed: specialistConsult,
    isolation_required: isolationRequired,
    nurse_observations: nurseObservations,
    patient_arrival_status: "ambulance",
    family_notifications: "Family not yet notified — awaiting patient consent and stabilization before contact.",
    override_flag: hasBlocked || hasSafetyFlags,
    handoff_to_doctor: handoffToDr,
  };
}

export async function runNurseAssessmentChain(encounter: Encounter): Promise<NurseAssessment> {
  const chain = createNurseAssessmentChain();

  if (!chain || !encounter.structuredData || !encounter.diagnosis) {
    return fallbackNurseAssessment(encounter);
  }

  try {
    const result = await chain.invoke({
      chiefComplaint: encounter.structuredData.chiefComplaint,
      vitals: JSON.stringify(encounter.structuredData.vitals),
      diagnosis: encounter.diagnosis.primary,
      confidence: (encounter.diagnosis.confidence * 100).toFixed(0) + "%",
      differentials: JSON.stringify(encounter.diagnosis.differentials),
      age: encounter.patientContext?.age ?? "unknown",
      sex: encounter.patientContext?.sex ?? "unknown",
      medications: encounter.patientContext?.currentMedications.join(", ") ?? "unknown",
      allergies: encounter.patientContext?.allergies.join(", ") ?? "none",
      existingConditions: encounter.patientContext?.conditions.join(", ") ?? "none",
      safetyFlags: encounter.safetyFlags?.length
        ? encounter.safetyFlags.map((f) => `${f.severity}: ${f.drug} vs ${f.conflictsWith}`).join("; ")
        : "None",
      transcript: encounter.rawTranscript.substring(0, 500),
      orders: encounter.draftOrders
        ? encounter.draftOrders.map((o) => `[${o.status}] ${o.type}: ${o.description}`).join("; ")
        : "None",
    });

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackNurseAssessment(encounter);

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      intake_notes: parsed.intake_notes || "",
      priority_rank: Math.min(5, Math.max(1, parsed.priority_rank || 3)),
      room_assignment: parsed.room_assignment || "Pending",
      bed_assignment: parsed.bed_assignment || "Pending",
      acuity_level: parsed.acuity_level || "ESI-3",
      equipment_requested: parsed.equipment_requested || [],
      triage_category: parsed.triage_category || "Urgent",
      estimated_wait_time: parsed.estimated_wait_time || "15 min",
      follow_up_tests: parsed.follow_up_tests || [],
      specialist_consult_needed: parsed.specialist_consult_needed || null,
      isolation_required: parsed.isolation_required || false,
      nurse_observations: parsed.nurse_observations || "",
      patient_arrival_status: parsed.patient_arrival_status || "ambulance",
      family_notifications: parsed.family_notifications || "",
      override_flag: parsed.override_flag || false,
      handoff_to_doctor: parsed.handoff_to_doctor || "",
    };
  } catch {
    return fallbackNurseAssessment(encounter);
  }
}
