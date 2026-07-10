import { NextRequest, NextResponse } from "next/server";
import { getEncounter } from "@/lib/store";
import { validateToken } from "@/lib/auth";
import { corsHeaders, corsResponse } from "@/lib/cors";
import { createChatModel } from "@/lib/chat-model-factory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  if (!validateToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
  }

  const { id } = await params;
  const encounter = await getEncounter(id);
  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404, headers: corsHeaders(origin) });
  }

  const vitals = encounter.structuredData?.vitals ?? {};
  const ctx = encounter.patientContext;
  const dx = encounter.diagnosis?.primary ?? "Unknown";

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a clinical decision support AI. Analyze the provided patient vitals in the context of their condition.
Return JSON only, no markdown:
{{
  "recommendations": ["string"],
  "warnings": ["string"],
  "critical": boolean,
  "summary": "string"
}}
- "recommendations": 2-4 short clinical suggestions for what the nurse should do given these vitals and condition
- "warnings": any dangerous or abnormal vitals (empty array if all fine)
- "critical": true if any vital is immediately life-threatening (e.g. SpO2 < 85, HR < 30 or > 180, RR < 6 or > 35, GCS < 8, SBP < 70)
- "summary": one sentence overall assessment`],
    ["human", `Patient: {name}, {age}yo {sex}
Diagnosis: {dx}
Conditions: {conditions}
Medications: {medications}
Allergies: {allergies}
Current Vitals:
- Heart Rate: {hr}
- Blood Pressure: {bp}
- SpO2: {spo2}%
- Temperature: {temp}°F
- Respiratory Rate: {rr}/min
- GCS: {gcs}/15`],
  ]);

  try {
    const model = createChatModel({ modelName: "claude-haiku-4-5-20251001", temperature: 0, maxTokens: 600 });
    if (!model) throw new Error("Model unavailable");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain = prompt.pipe(model as any).pipe(new StringOutputParser());
    const raw = await chain.invoke({
      name: ctx?.name ?? "Unknown",
      age: ctx?.age ?? "Unknown",
      sex: ctx?.sex ?? "Unknown",
      dx,
      conditions: ctx?.conditions?.join(", ") || "None",
      medications: ctx?.currentMedications?.join(", ") || "None",
      allergies: ctx?.allergies?.join(", ") || "None",
      hr:   String(vitals.heartRate       ?? "Not recorded"),
      bp:   String(vitals.bloodPressure   ?? "Not recorded"),
      spo2: String(vitals.spO2            ?? "Not recorded"),
      temp: String(vitals.temperature     ?? "Not recorded"),
      rr:   String(vitals.respiratoryRate ?? "Not recorded"),
      gcs:  String(vitals.gcs             ?? "Not recorded"),
    });

    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(json, { headers: corsHeaders(origin) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: corsHeaders(origin) });
  }
}
