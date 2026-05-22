import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { GuidelineResult, Encounter } from "@/types";

const GUIDELINES_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a clinical guidelines retrieval agent. Given a diagnosis, return the relevant
evidence-based treatment guidelines (e.g. AHA/ASA, ACC, Surviving Sepsis) so the action
planner drafts protocol-aligned orders and the safety controller knows the red flags.
Output valid JSON with this exact schema:
{{
  "condition": "string",
  "source": "guideline body + year",
  "recommendations": [{{ "text": "recommendation", "class": "Class I|IIa|IIb|III", "evidenceLevel": "Level A|B|C" }}],
  "timeWindow": "string or null",
  "redFlags": ["contraindication or caution the planner must respect"],
  "summary": "one-sentence takeaway"
}}
Be specific and clinically accurate. redFlags should name concrete contraindications
(e.g. "anticoagulation/elevated INR contraindicates tPA").`,
  ],
  [
    "human",
    `Diagnosis: {diagnosis} (ICD-10 {icdCode}, confidence {confidence})
Patient: {age}yo {sex}, Medications: {medications}, Conditions: {existingConditions}
Reasoning: {reasoning}`,
  ],
]);

function createGuidelinesChain() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-key") return null;

  const model = new ChatAnthropic({
    modelName: "claude-sonnet-4-20250514",
    anthropicApiKey: apiKey,
    temperature: 0,
    maxTokens: 1500,
  });

  return RunnableSequence.from([GUIDELINES_PROMPT, model, new StringOutputParser()]);
}

// Deterministic fallback so the agent works with no API key (demo-safe).
export function fallbackGuidelines(encounter: Encounter): GuidelineResult {
  const primary = encounter.diagnosis?.primary ?? "";

  if (primary.includes("Stroke")) {
    return {
      condition: "Acute Ischemic Stroke",
      source: "AHA/ASA 2019 Acute Ischemic Stroke Guidelines",
      recommendations: [
        { text: "IV alteplase (tPA) for eligible patients within 4.5h of symptom onset", class: "Class I", evidenceLevel: "Level A" },
        { text: "Mechanical thrombectomy for large vessel occlusion within 24h in selected patients", class: "Class I", evidenceLevel: "Level A" },
        { text: "Non-contrast CT head to exclude hemorrhage before thrombolysis", class: "Class I", evidenceLevel: "Level A" },
      ],
      timeWindow: "tPA within 4.5h of onset; thrombectomy up to 24h in selected patients",
      redFlags: [
        "Active anticoagulation or elevated INR contraindicates tPA (hemorrhage risk)",
        "Recent surgery, hemorrhage, or BP >185/110 are tPA exclusions",
      ],
      summary: "Confirm onset window and exclude hemorrhage/anticoagulation before thrombolysis; thrombectomy is the alternative for LVO.",
    };
  }

  if (primary.includes("STEMI") || primary.includes("MI") || primary.includes("Myocardial")) {
    return {
      condition: "ST-Elevation Myocardial Infarction",
      source: "ACC/AHA 2013 STEMI Guidelines",
      recommendations: [
        { text: "Primary PCI within 90 minutes of first medical contact", class: "Class I", evidenceLevel: "Level A" },
        { text: "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor)", class: "Class I", evidenceLevel: "Level A" },
        { text: "Anticoagulation during PCI", class: "Class I", evidenceLevel: "Level C" },
      ],
      timeWindow: "Door-to-balloon within 90 minutes",
      redFlags: [
        "Active bleeding or recent stroke cautions against dual antiplatelet/anticoagulation",
        "Confirm no aortic dissection before anticoagulation",
      ],
      summary: "Reperfuse fast (PCI < 90 min) with dual antiplatelet therapy; screen for bleeding contraindications.",
    };
  }

  if (primary.includes("Sepsis") || primary.includes("sepsis")) {
    return {
      condition: "Sepsis / Septic Shock",
      source: "Surviving Sepsis Campaign 2021",
      recommendations: [
        { text: "Broad-spectrum antibiotics within 1 hour of recognition", class: "Class I", evidenceLevel: "Level B" },
        { text: "30 mL/kg crystalloid for hypotension or lactate >=4 mmol/L", class: "Class I", evidenceLevel: "Level B" },
        { text: "Obtain blood cultures before antibiotics when feasible", class: "Class I", evidenceLevel: "Level C" },
      ],
      timeWindow: "Antibiotics + fluids within the first hour",
      redFlags: ["Adjust antibiotics for documented allergies", "Caution with aggressive fluids in heart failure"],
      summary: "Hour-1 bundle: cultures, broad-spectrum antibiotics, and 30 mL/kg crystalloid.",
    };
  }

  // Generic fallback when no specific guideline matches
  return {
    condition: primary || "Undetermined",
    source: "General clinical best practice",
    recommendations: [
      { text: "Stabilize ABCs and obtain confirmatory diagnostics before definitive therapy", class: "Class I", evidenceLevel: "Level C" },
    ],
    timeWindow: undefined,
    redFlags: ["Verify allergies and current medications before ordering"],
    summary: "No condition-specific guideline matched; proceed with standard stabilization and confirmatory workup.",
  };
}

export async function runGuidelinesChain(encounter: Encounter): Promise<GuidelineResult> {
  const chain = createGuidelinesChain();

  if (!chain || !encounter.diagnosis) {
    return fallbackGuidelines(encounter);
  }

  try {
    const result = await chain.invoke({
      diagnosis: encounter.diagnosis.primary,
      icdCode: encounter.diagnosis.icdCode,
      confidence: (encounter.diagnosis.confidence * 100).toFixed(0) + "%",
      reasoning: encounter.diagnosis.reasoning,
      age: encounter.patientContext?.age ?? "unknown",
      sex: encounter.patientContext?.sex ?? "unknown",
      medications: encounter.patientContext?.currentMedications.join(", ") ?? "unknown",
      existingConditions: encounter.patientContext?.conditions.join(", ") ?? "unknown",
    });

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackGuidelines(encounter);

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      condition: parsed.condition || encounter.diagnosis.primary,
      source: parsed.source || "Clinical guidelines",
      recommendations: (parsed.recommendations || []).map((r: Record<string, string>) => ({
        text: r.text || "",
        class: r.class || "",
        evidenceLevel: r.evidenceLevel || "",
      })),
      timeWindow: parsed.timeWindow || undefined,
      redFlags: parsed.redFlags || [],
      summary: parsed.summary || "",
    };
  } catch {
    return fallbackGuidelines(encounter);
  }
}
