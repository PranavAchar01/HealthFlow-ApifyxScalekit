import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { NursingCarePlan, NursingCarePlanStep, Encounter } from "@/types";
import { createChatModel } from "@/lib/chat-model-factory";

const CARE_PLAN_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an ED registered-nurse AI agent. Given everything known about an incoming patient
(field transcript, vitals, diagnosis, allergies, medications, safety flags, triage assessment),
produce the concrete NURSING care plan — the ordered, hands-on steps THIS NURSE should perform to
treat and stabilize the patient. These are nursing interventions, NOT physician orders and NOT a
diagnosis. Think ABCDE (Airway, Breathing, Circulation, Disability, Exposure) and prioritize.

Output valid JSON with this exact schema:
{{
  "summary": "string — one-sentence overview of the nursing approach",
  "steps": [
    {{
      "order": 1,
      "action": "string — specific nursing action (imperative, e.g. 'Apply high-flow O2 at 15L via NRB')",
      "rationale": "string — why this step matters for this patient",
      "priority": "immediate|urgent|routine",
      "category": "airway|breathing|circulation|medication|monitoring|comfort|safety|communication"
    }}
  ]
}}
Rules:
- 5 to 9 steps, ordered by clinical priority (most life-critical first).
- Respect allergies and safety flags — never recommend a flagged/contraindicated drug; note the allergy in 'safety' steps.
- Be specific and clinically realistic. Use the patient's actual vitals and history.`,
  ],
  [
    "human",
    `Chief Complaint: {chiefComplaint}
Vitals: {vitals}
Diagnosis: {diagnosis} (confidence: {confidence})
Patient: {age}yo {sex}; Allergies: {allergies}; Medications: {medications}; Conditions: {conditions}
Safety Flags: {safetyFlags}
Triage / Nurse Assessment: {nurseAssessment}
Field Transcript: {transcript}`,
  ],
]);

function createCarePlanChain() {
  try {
    const model = createChatModel({ modelName: "claude-sonnet-4-20250514", temperature: 0, maxTokens: 2000 });
    if (!model) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return RunnableSequence.from([CARE_PLAN_PROMPT, model as any, new StringOutputParser()]);
  } catch {
    return null;
  }
}

function step(
  order: number,
  action: string,
  rationale: string,
  priority: NursingCarePlanStep["priority"],
  category: NursingCarePlanStep["category"]
): NursingCarePlanStep {
  return { order, action, rationale, priority, category };
}

function fallbackCarePlan(encounter: Encounter): NursingCarePlan {
  const dx = encounter.diagnosis?.primary ?? "";
  const cc = encounter.structuredData?.chiefComplaint ?? "";
  const hay = `${dx} ${cc}`.toLowerCase();
  const patient = encounter.patientContext;
  const allergies = (patient?.allergies ?? []).filter((a) => a && a.toUpperCase() !== "NKDA");
  const vitals = encounter.structuredData?.vitals;
  const hasFlags = (encounter.safetyFlags?.length ?? 0) > 0;

  const steps: NursingCarePlanStep[] = [];
  let n = 1;

  // Universal first move
  steps.push(step(n++, "Place patient on continuous cardiac monitor, SpO2, and automated BP cycling q5min", "Establish a real-time vitals baseline and detect deterioration early.", "immediate", "monitoring"));

  if (hay.includes("stroke")) {
    steps.push(step(n++, "Protect airway; position HOB at 30°, suction ready, keep NPO until swallow screen", "Reduces aspiration risk and ICP in suspected stroke.", "immediate", "airway"));
    steps.push(step(n++, "Establish two large-bore IVs and draw STAT labs (CBC, BMP, PT/INR, troponin, glucose)", "IV access and coagulation status are required before any thrombolytic decision.", "immediate", "circulation"));
    steps.push(step(n++, "Perform fingerstick glucose now", "Hypoglycemia is a stroke mimic and must be excluded immediately.", "immediate", "monitoring"));
    steps.push(step(n++, "Document last-known-well time and complete NIHSS stroke scale", "Time window drives tPA/thrombectomy eligibility.", "urgent", "communication"));
    steps.push(step(n++, "Clear patient for STAT non-contrast CT head and pre-alert CT/neurology", "Imaging must precede thrombolytics; pre-alert saves door-to-needle time.", "urgent", "communication"));
  } else if (hay.includes("stemi") || hay.includes("myocardial") || hay.includes("chest pain") || hay.includes("mi ")) {
    steps.push(step(n++, "Obtain 12-lead ECG within 10 minutes and place on defibrillator pads", "Confirms STEMI and prepares for arrhythmia/arrest.", "immediate", "circulation"));
    steps.push(step(n++, "Apply oxygen only if SpO2 < 94%; establish IV access", "Routine O2 in normoxia can be harmful; IV needed for meds.", "immediate", "breathing"));
    steps.push(step(n++, "Draw STAT troponin, CBC, BMP, coags; send type & screen", "Baseline cardiac and bleeding-risk data before cath lab.", "urgent", "circulation"));
    steps.push(step(n++, "Prepare for chest pain protocol meds per physician (ASA already daily — verify before re-dosing)", "Avoid double-dosing aspirin; expedite reperfusion meds.", "urgent", "medication"));
    steps.push(step(n++, "Pre-alert cath lab / cardiology", "Shortens door-to-balloon time.", "urgent", "communication"));
  } else if (hay.includes("respiratory") || hay.includes("copd") || hay.includes("breath")) {
    steps.push(step(n++, "Sit patient fully upright; apply titrated O2 and prepare BiPAP/CPAP", "Optimizes oxygenation and work of breathing in respiratory distress.", "immediate", "breathing"));
    steps.push(step(n++, "Reassess SpO2 and respiratory effort continuously; have suction and airway cart at bedside", "Early detection of impending respiratory failure.", "immediate", "airway"));
    steps.push(step(n++, "Establish IV access and obtain ABG", "Guides ventilation strategy and acid-base management.", "urgent", "circulation"));
    steps.push(step(n++, "Set up nebulizer for bronchodilators per order", "Reverses bronchospasm component.", "urgent", "medication"));
  } else if (hay.includes("hypoglycemia") || hay.includes("diabetic")) {
    steps.push(step(n++, "Perform fingerstick glucose immediately and recheck q15min", "Confirms and trends hypoglycemia severity.", "immediate", "monitoring"));
    steps.push(step(n++, "Establish IV access; prepare D50 (or IM glucagon if no IV)", "Rapid glucose correction prevents neurologic injury.", "immediate", "medication"));
    steps.push(step(n++, "Protect airway and position safely if altered mental status", "Reduces aspiration risk during confusion.", "immediate", "airway"));
    steps.push(step(n++, "Once alert, provide complex-carb meal and re-educate on insulin/meal timing", "Prevents rebound hypoglycemia.", "routine", "comfort"));
  } else if (hay.includes("trauma") || hay.includes("mva") || hay.includes("fracture")) {
    steps.push(step(n++, "Maintain full C-spine precautions; do not remove collar until cleared", "Prevents secondary spinal cord injury.", "immediate", "safety"));
    steps.push(step(n++, "Complete primary survey (ABCDE) and expose to assess for occult injury", "Identifies life threats in priority order.", "immediate", "circulation"));
    steps.push(step(n++, "Establish two large-bore IVs; send type & cross", "Prepares for resuscitation and possible transfusion.", "urgent", "circulation"));
    steps.push(step(n++, "Immobilize injured extremity, apply ice, assess distal pulses/sensation", "Limits further injury and monitors neurovascular status.", "urgent", "comfort"));
  } else if (hay.includes("seizure") || hay.includes("febrile")) {
    steps.push(step(n++, "Position on side, pad rails, keep nothing in mouth; have suction ready", "Protects airway and prevents injury during/after seizure.", "immediate", "safety"));
    steps.push(step(n++, "Monitor airway and SpO2 through the post-ictal period", "Post-ictal patients can hypoventilate.", "immediate", "airway"));
    steps.push(step(n++, "Obtain temperature and initiate antipyretic cooling measures", "Treats the febrile trigger.", "urgent", "comfort"));
    steps.push(step(n++, "Fingerstick glucose; establish IV access", "Excludes hypoglycemia and prepares for benzodiazepine if seizure recurs.", "urgent", "medication"));
  } else if (hay.includes("overdose") || hay.includes("opioid") || hay.includes("unresponsive")) {
    steps.push(step(n++, "Open airway, suction secretions, support ventilation with BVM as needed", "Respiratory depression is the lethal threat in opioid overdose.", "immediate", "airway"));
    steps.push(step(n++, "Administer naloxone per protocol and titrate to adequate respiration", "Reverses opioid-induced respiratory depression.", "immediate", "medication"));
    steps.push(step(n++, "Establish IV access; fingerstick glucose; continuous SpO2 and capnography", "Excludes hypoglycemia and monitors re-sedation.", "urgent", "monitoring"));
    steps.push(step(n++, "Observe for re-narcotization as naloxone wears off", "Naloxone is shorter-acting than many opioids.", "urgent", "monitoring"));
  } else {
    steps.push(step(n++, "Complete a focused head-to-toe assessment and full vital set", "Builds a clinical baseline when the picture is undifferentiated.", "urgent", "monitoring"));
    steps.push(step(n++, "Establish IV access and draw baseline labs (CBC, BMP)", "Enables rapid treatment and diagnostics.", "urgent", "circulation"));
    steps.push(step(n++, "Assess and document pain score; provide comfort measures", "Pain control and reassessment are core nursing duties.", "routine", "comfort"));
  }

  // Allergy safety step (always near top of mind)
  if (allergies.length > 0) {
    steps.push(step(n++, `Apply red allergy band and flag chart: ${allergies.join(", ")}`, "Prevents administration of contraindicated agents.", "immediate", "safety"));
  }
  if (hasFlags) {
    steps.push(step(n++, "Hold any drug-interaction-flagged orders and confirm with physician before administration", "Active safety flags require pharmacist/physician review first.", "immediate", "safety"));
  }

  // Hypoxia-specific add-on
  if (vitals?.spO2 && vitals.spO2 < 94 && !hay.includes("respiratory")) {
    steps.push(step(n++, `Apply supplemental O2 — SpO2 ${vitals.spO2}% below target`, "Corrects hypoxemia.", "immediate", "breathing"));
  }

  // Family communication closer
  steps.push(step(n++, "Notify family/emergency contact and provide brief status update once stable", "Keeps next-of-kin informed and supports consent.", "routine", "communication"));

  // Re-number after conditional inserts so order is contiguous
  steps.forEach((s, i) => (s.order = i + 1));

  return {
    summary: dx
      ? `Nursing priorities for ${dx}: stabilize ABCs, protect against known allergies/interactions, and prepare for the physician's diagnostic plan.`
      : "Nursing priorities: establish monitoring and IV access, complete a focused assessment, and treat symptoms while diagnostics proceed.",
    steps,
    generatedAt: new Date().toISOString(),
    engine: "rule-based",
  };
}

export async function runNurseCarePlanChain(encounter: Encounter): Promise<NursingCarePlan> {
  const chain = createCarePlanChain();
  if (!chain || !encounter.structuredData) return fallbackCarePlan(encounter);

  try {
    const result = await chain.invoke({
      chiefComplaint: encounter.structuredData.chiefComplaint,
      vitals: JSON.stringify(encounter.structuredData.vitals),
      diagnosis: encounter.diagnosis?.primary ?? "pending",
      confidence: encounter.diagnosis ? (encounter.diagnosis.confidence * 100).toFixed(0) + "%" : "n/a",
      age: encounter.patientContext?.age ?? "unknown",
      sex: encounter.patientContext?.sex ?? "unknown",
      allergies: encounter.patientContext?.allergies.join(", ") ?? "unknown",
      medications: encounter.patientContext?.currentMedications.join(", ") ?? "unknown",
      conditions: encounter.patientContext?.conditions.join(", ") ?? "none",
      safetyFlags: encounter.safetyFlags?.length
        ? encounter.safetyFlags.map((f) => `${f.severity}: ${f.drug} vs ${f.conflictsWith}`).join("; ")
        : "None",
      nurseAssessment: encounter.nurseAssessment
        ? `${encounter.nurseAssessment.acuity_level}, ${encounter.nurseAssessment.triage_category}, ${encounter.nurseAssessment.intake_notes}`
        : "pending",
      transcript: encounter.rawTranscript.substring(0, 600),
    });

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackCarePlan(encounter);
    const parsed = JSON.parse(jsonMatch[0]);
    const rawSteps: unknown[] = Array.isArray(parsed.steps) ? parsed.steps : [];
    if (rawSteps.length === 0) return fallbackCarePlan(encounter);

    const steps: NursingCarePlanStep[] = rawSteps.map((s, i) => {
      const o = s as Record<string, unknown>;
      return {
        order: typeof o.order === "number" ? o.order : i + 1,
        action: String(o.action ?? ""),
        rationale: String(o.rationale ?? ""),
        priority: (["immediate", "urgent", "routine"].includes(String(o.priority))
          ? o.priority
          : "urgent") as NursingCarePlanStep["priority"],
        category: ([
          "airway", "breathing", "circulation", "medication", "monitoring", "comfort", "safety", "communication",
        ].includes(String(o.category))
          ? o.category
          : "monitoring") as NursingCarePlanStep["category"],
      };
    });
    steps.sort((a, b) => a.order - b.order).forEach((s, i) => (s.order = i + 1));

    return {
      summary: String(parsed.summary ?? "Nursing care plan generated."),
      steps,
      generatedAt: new Date().toISOString(),
      engine: "ai",
    };
  } catch {
    return fallbackCarePlan(encounter);
  }
}
