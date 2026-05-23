import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { DiagnosisResult, Encounter } from "@/types";
import { createChatModel } from "@/lib/chat-model-factory";

// Aggregate diagnosis chain — re-runs the differential with ALL accumulated
// clinical input: 911 dispatch info, paramedic field transcript + observations,
// AND nurse triage notes. Used by /api/encounters/[id]/rediagnose to keep the
// AI's recommendation current as each role adds information.
const AGGREGATE_DIAGNOSIS_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are the final diagnostic AI for an ED handoff. You are receiving information
from THREE collaborating clinicians plus the dispatch system. Synthesize ALL of it
into a single recommended diagnosis with explicit reasoning that names which
sources you weighted most.

Output valid JSON:
{{
  "primary": "primary diagnosis name",
  "icdCode": "ICD-10 code",
  "confidence": 0.0-1.0,
  "differentials": [{{ "condition": "name", "probability": 0.0-1.0 }}],
  "reasoning": "clinical reasoning citing dispatch / paramedic / nursing inputs"
}}

Be explicit when nurse-side observations change the picture (e.g., new vitals,
medication response, repeated assessment). If confidence rises because multiple
sources converge, say so. If sources conflict, surface the conflict.`,
  ],
  [
    "human",
    `=== DISPATCH (911) ===
Patient: {patientName}, Age {age}, Sex {sex}
Known Conditions: {existingConditions}
Medications: {medications}
Allergies: {allergies}

=== PARAMEDIC FIELD REPORT ===
Chief Complaint: {chiefComplaint}
Field Transcript: {transcript}
Vitals on arrival: {vitals}
Observations: {observations}
Detected conditions: {detectedConditions}

=== NURSE TRIAGE NOTES ===
Triage status: {triageStatus}
{nursingNotes}

=== PRIOR AI DIAGNOSIS (for context) ===
{priorDiagnosis}

Provide an updated aggregate diagnosis.`,
  ],
]);

function createAggregateChain() {
  try {
    const model = createChatModel({ modelName: "claude-sonnet-4-20250514", temperature: 0, maxTokens: 1500 });
    if (!model) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return RunnableSequence.from([AGGREGATE_DIAGNOSIS_PROMPT, model as any, new StringOutputParser()]);
  } catch {
    return null;
  }
}

function fallbackAggregate(encounter: Encounter): DiagnosisResult {
  // No LLM available — recompute heuristically with nursing context baked in.
  const base = encounter.diagnosis ?? {
    primary: encounter.structuredData?.chiefComplaint ?? "Undetermined",
    icdCode: "R69",
    confidence: 0.5,
    differentials: [],
    reasoning: "",
  };
  const noteCount = encounter.nursingNotes?.length ?? 0;
  const escalated = encounter.triageStatus === "escalated";
  // Each nurse note nudges confidence up slightly; escalation flags raise it more.
  const bump = Math.min(0.15, noteCount * 0.03 + (escalated ? 0.1 : 0));
  return {
    ...base,
    confidence: Math.min(0.98, base.confidence + bump),
    reasoning:
      `Aggregate (no LLM): ${base.reasoning}` +
      (noteCount > 0 ? ` Reinforced by ${noteCount} nursing observation(s).` : "") +
      (escalated ? " Nurse-flagged escalation increases priority." : ""),
  };
}

export async function runAggregateDiagnosis(encounter: Encounter): Promise<DiagnosisResult> {
  const chain = createAggregateChain();
  if (!chain) return fallbackAggregate(encounter);

  const sd = encounter.structuredData;
  const pc = encounter.patientContext;
  const notes = encounter.nursingNotes ?? [];

  try {
    const result = await chain.invoke({
      patientName: pc?.name ?? "Unknown",
      age: pc?.age ?? "?",
      sex: pc?.sex ?? "?",
      existingConditions: pc?.conditions?.join(", ") || "none",
      medications: pc?.currentMedications?.join(", ") || "none",
      allergies: pc?.allergies?.join(", ") || "NKDA",
      chiefComplaint: sd?.chiefComplaint ?? "unknown",
      transcript: encounter.rawTranscript || "(none captured)",
      vitals: JSON.stringify(sd?.vitals ?? {}),
      observations: JSON.stringify(sd?.observations ?? []),
      detectedConditions: JSON.stringify(sd?.conditions ?? []),
      triageStatus: encounter.triageStatus ?? "pending",
      nursingNotes: notes.length
        ? notes.map(n => `- [${n.category}] ${n.nurseName}: ${n.note}`).join("\n")
        : "(no nursing notes yet)",
      priorDiagnosis: encounter.diagnosis
        ? `${encounter.diagnosis.primary} (conf ${(encounter.diagnosis.confidence * 100).toFixed(0)}%) — ${encounter.diagnosis.reasoning}`
        : "(none — first diagnosis)",
    });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackAggregate(encounter);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      primary: parsed.primary || encounter.diagnosis?.primary || "Undetermined",
      icdCode: parsed.icdCode || encounter.diagnosis?.icdCode || "R69",
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
      differentials: parsed.differentials || [],
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return fallbackAggregate(encounter);
  }
}
