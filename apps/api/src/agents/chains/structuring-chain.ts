import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Encounter, Vitals, FHIRObservation, FHIRCondition } from "@/types";
import { createChatModel } from "@/lib/chat-model-factory";

const STRUCTURING_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a medical data structuring agent. Extract structured clinical data from paramedic field transcripts.
Output valid JSON with this exact schema:
{{
  "chiefComplaint": "string",
  "vitals": {{ "heartRate": number|null, "bloodPressure": "string|null", "spO2": number|null, "respiratoryRate": number|null, "temperature": number|null, "gcs": number|null }},
  "observations": [{{ "code": "LOINC/ICD code", "display": "name", "value": "string or number", "unit": "string" }}],
  "conditions": [{{ "code": "ICD-10 code", "display": "condition name", "severity": "mild|moderate|severe" }}],
  "narrative": "cleaned clinical narrative"
}}
Be precise with vital signs. Use standard LOINC codes for observations and ICD-10 for conditions.`,
  ],
  ["human", "Transcript: {transcript}"],
]);

function createStructuringChain() {
  try {
    const model = createChatModel({ modelName: "claude-sonnet-4-20250514", temperature: 0, maxTokens: 2000 });
    if (!model) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return RunnableSequence.from([STRUCTURING_PROMPT, model as any, new StringOutputParser()]);
  } catch {
    return null;
  }
}

export function fallbackStructuring(rawText: string): NonNullable<Encounter["structuredData"]> {
  const text = rawText.toLowerCase();
  const vitals: Vitals = {};
  const observations: FHIRObservation[] = [];
  const conditions: FHIRCondition[] = [];
  let chiefComplaint = "Undetermined";
  const now = new Date().toISOString();

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

  const has = (...kws: string[]) => kws.some((k) => text.includes(k));
  // Match "MI" only as a whole word — otherwise it hits "MInutes", "faMIly", etc.
  const mentionsMI = /\bmi\b/.test(text) || has("stemi", "myocardial", "heart attack");

  if (has("stroke", "paralysis", "facial droop", "face droop", "droopy", "slurred speech", "trouble speaking", "can't speak", "cant speak", "hemiparesis") ||
      (has("left", "right", "arm", "leg", "face") && has("won't move", "wont move", "can't move", "cant move", "weakness", "numb"))) {
    chiefComplaint = "Suspected Stroke";
    conditions.push({ resourceType: "Condition", code: "I63.9", display: "Cerebral Infarction (Ischemic Stroke)", severity: "severe", onsetDateTime: now });
  } else if (has("chest pain") || mentionsMI) {
    chiefComplaint = "Chest Pain / Suspected MI";
    conditions.push({ resourceType: "Condition", code: "I21.9", display: "Acute Myocardial Infarction", severity: "severe", onsetDateTime: now });
  } else if (has("overdose", "naloxone", "narcan", "opioid", "unresponsive", "syringe")) {
    chiefComplaint = "Suspected Overdose";
    conditions.push({ resourceType: "Condition", code: "T40.60", display: "Poisoning by Narcotics", severity: "severe", onsetDateTime: now });
  } else if (has("seizure", "convulsion", "febrile", "shaking")) {
    chiefComplaint = "Seizure";
    conditions.push({ resourceType: "Condition", code: "R56.9", display: "Seizure", severity: "moderate", onsetDateTime: now });
  } else if (has("hypoglycemia", "low sugar", "low blood sugar", "diabetic", "insulin")) {
    chiefComplaint = "Diabetic Emergency";
    conditions.push({ resourceType: "Condition", code: "E16.2", display: "Hypoglycemia", severity: "moderate", onsetDateTime: now });
  } else if (has("trauma", "accident", "injury", "mva", "collision", "fell", "fall", "fracture")) {
    chiefComplaint = "Trauma";
    conditions.push({ resourceType: "Condition", code: "T07", display: "Multiple Injuries", severity: "moderate", onsetDateTime: now });
  } else if (has("breathing", "breathe", "dyspnea", "shortness of breath", "can't breathe", "cant breathe", "copd", "respiratory")) {
    chiefComplaint = "Respiratory Distress";
    conditions.push({ resourceType: "Condition", code: "R06.0", display: "Dyspnea", severity: "moderate", onsetDateTime: now });
  }

  if (text.includes("left") && (text.includes("paralysis") || text.includes("weakness") || text.includes("hemiparesis"))) {
    observations.push({ resourceType: "Observation", code: "G81.9", display: "Left-sided Hemiparesis", value: "Present", timestamp: now });
  }

  const onsetMatch = text.match(/onset[:\s]*(\d+)\s*(minutes?|mins?|hours?|hrs?)\s*ago/);
  if (onsetMatch) {
    observations.push({ resourceType: "Observation", code: "ONSET", display: "Symptom Onset", value: `${onsetMatch[1]} ${onsetMatch[2]} ago`, timestamp: now });
  }

  return { chiefComplaint, vitals, observations, conditions, narrative: rawText };
}

export async function runStructuringChain(transcript: string): Promise<NonNullable<Encounter["structuredData"]>> {
  const chain = createStructuringChain();

  if (!chain) {
    return fallbackStructuring(transcript);
  }

  try {
    const result = await chain.invoke({ transcript });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackStructuring(transcript);

    const parsed = JSON.parse(jsonMatch[0]);
    const now = new Date().toISOString();

    return {
      chiefComplaint: parsed.chiefComplaint || "Undetermined",
      vitals: parsed.vitals || {},
      observations: (parsed.observations || []).map((o: Record<string, string>) => ({
        resourceType: "Observation" as const,
        code: o.code || "",
        display: o.display || "",
        value: o.value || "",
        unit: o.unit || "",
        timestamp: now,
      })),
      conditions: (parsed.conditions || []).map((c: Record<string, string>) => ({
        resourceType: "Condition" as const,
        code: c.code || "",
        display: c.display || "",
        severity: c.severity || "moderate",
        onsetDateTime: now,
      })),
      narrative: parsed.narrative || transcript,
    };
  } catch {
    return fallbackStructuring(transcript);
  }
}
