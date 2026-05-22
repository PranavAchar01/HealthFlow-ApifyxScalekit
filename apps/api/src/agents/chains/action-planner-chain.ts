import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { DraftOrder, Encounter } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { createChatModel } from "@/lib/chat-model-factory";

const ACTION_PLANNER_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a clinical action planner. Based on the diagnosis and patient data, draft appropriate medical orders.
Output valid JSON array of orders:
[{{
  "type": "medication|procedure|imaging|lab|consult",
  "description": "order description",
  "urgency": "routine|urgent|stat",
  "medication": {{ "medication": "name", "dosage": "dose", "route": "PO|IV|IM|SC" }} // only for medication type
}}]
Consider the full clinical picture. Orders should be evidence-based and appropriate for the acuity level.`,
  ],
  [
    "human",
    `Diagnosis: {diagnosis} (confidence: {confidence})
Chief Complaint: {chiefComplaint}
Patient: {age}yo {sex}, Medications: {medications}
Differentials: {differentials}`,
  ],
]);

function createActionPlannerChain() {
  try {
    const model = createChatModel({
      modelName: "claude-sonnet-4-20250514",
      temperature: 0,
      maxTokens: 2000,
    });
    return RunnableSequence.from([ACTION_PLANNER_PROMPT, model, new StringOutputParser()]);
  } catch (error) {
    console.error("Could not create action planner chain:", error);
    return null;
  }
}

function fallbackActionPlanner(encounter: Encounter): DraftOrder[] {
  const diagnosis = encounter.diagnosis;
  const orders: DraftOrder[] = [];

  if (diagnosis?.primary.includes("Stroke")) {
    orders.push(
      {
        id: uuidv4(), type: "medication", description: "Alteplase (tPA) IV bolus + infusion", urgency: "stat",
        medication: { resourceType: "MedicationRequest", medication: "tPA (Alteplase)", dosage: "0.9 mg/kg IV, max 90mg, 10% bolus over 1 min, remainder over 60 min", route: "IV", status: "draft" },
        status: "drafted",
      },
      { id: uuidv4(), type: "imaging", description: "CT Angiogram Head and Neck - STAT", urgency: "stat", status: "drafted" },
      { id: uuidv4(), type: "consult", description: "Activate Stroke Team - Code Stroke", urgency: "stat", status: "drafted" },
      { id: uuidv4(), type: "lab", description: "STAT: CBC, BMP, PT/INR, Troponin, Type & Screen", urgency: "stat", status: "drafted" }
    );
  } else if (diagnosis?.primary.includes("MI") || diagnosis?.primary.includes("STEMI")) {
    orders.push(
      {
        id: uuidv4(), type: "medication", description: "Aspirin 325mg PO STAT", urgency: "stat",
        medication: { resourceType: "MedicationRequest", medication: "Aspirin", dosage: "325mg PO", route: "PO", status: "draft" },
        status: "drafted",
      },
      { id: uuidv4(), type: "procedure", description: "12-Lead ECG STAT", urgency: "stat", status: "drafted" },
      { id: uuidv4(), type: "consult", description: "Activate Cardiac Catheterization Lab", urgency: "stat", status: "drafted" }
    );
  }

  return orders;
}

export async function runActionPlannerChain(encounter: Encounter): Promise<DraftOrder[]> {
  const chain = createActionPlannerChain();

  if (!chain || !encounter.diagnosis) {
    return fallbackActionPlanner(encounter);
  }

  try {
    const result = await chain.invoke({
      diagnosis: encounter.diagnosis.primary,
      confidence: (encounter.diagnosis.confidence * 100).toFixed(0) + "%",
      chiefComplaint: encounter.structuredData?.chiefComplaint ?? "",
      age: encounter.patientContext?.age ?? "unknown",
      sex: encounter.patientContext?.sex ?? "unknown",
      medications: encounter.patientContext?.currentMedications.join(", ") ?? "unknown",
      differentials: JSON.stringify(encounter.diagnosis.differentials),
    });

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackActionPlanner(encounter);

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((o: Record<string, unknown>) => ({
      id: uuidv4(),
      type: o.type || "procedure",
      description: o.description || "",
      urgency: o.urgency || "routine",
      medication: o.medication
        ? {
            resourceType: "MedicationRequest" as const,
            medication: (o.medication as Record<string, string>).medication || "",
            dosage: (o.medication as Record<string, string>).dosage || "",
            route: (o.medication as Record<string, string>).route || "",
            status: "draft" as const,
          }
        : undefined,
      status: "drafted" as const,
    }));
  } catch {
    return fallbackActionPlanner(encounter);
  }
}
