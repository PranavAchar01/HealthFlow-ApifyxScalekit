import { NextRequest, NextResponse } from "next/server";
import { validateToken, requirePermission } from "@/lib/auth";
import { getAllEncounters, upsertEncounter, setActiveSelection } from "@/lib/store";
import { runProgressivePipeline } from "@/agents/agent-pipeline";
import { createAuditEntry } from "@/lib/audit";
import { corsHeaders, corsResponse } from "@/lib/cors";
import type { Encounter, PatientContext } from "@/types";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

type SeedPatient = {
  patientId?: string;
  name?: string;
  age?: number;
  sex?: string;
  allergies?: string[];
  medications?: string[];
  conditions?: string[];
  chiefComplaint?: string;
};

// POST /api/encounters/seed
// Called when a 911 dispatcher clicks a patient. Creates (or re-focuses) an
// encounter seeded from the preset, broadcasts it + the active selection so every
// open CRM jumps to the same patient, then runs the AI pipeline in the background.
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const token = validateToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
  }
  if (!requirePermission(token, "field_data_entry")) {
    return NextResponse.json({ error: "Forbidden: Missing 'field_data_entry' permission" }, { status: 403, headers: corsHeaders(origin) });
  }

  const body = await req.json();
  const patient: SeedPatient = body.patient ?? {};
  const transcript: string = typeof body.transcript === "string" ? body.transcript : "";
  // autorun=false lets a caller (e.g. the paramedic doing live capture) create the
  // shared encounter without immediately firing the full AI pipeline — they drive
  // it themselves via /live + finalize.
  const autorun: boolean = body.autorun !== false;

  // Re-focus an existing, still-active encounter for this patient instead of duplicating.
  const presetId = patient.patientId;
  if (presetId) {
    const existing = (await getAllEncounters()).find(
      (e) => e.patientContext?.patientId === presetId && e.status !== "committed"
    );
    if (existing) {
      setActiveSelection(existing.id);
      return NextResponse.json({ encounter: existing, reused: true }, { headers: corsHeaders(origin) });
    }
  }

  const sex = patient.sex === "M" ? "Male" : patient.sex === "F" ? "Female" : (patient.sex ?? "Unknown");
  const allergies = (patient.allergies && patient.allergies.length) ? patient.allergies : ["NKDA"];

  const patientContext: PatientContext = {
    patientId: presetId || `PT-${Date.now().toString().slice(-6)}`,
    name: patient.name || "Unknown Patient",
    age: patient.age ?? 0,
    sex,
    allergies,
    currentMedications: patient.medications ?? [],
    conditions: patient.conditions ?? [],
  };

  const now = new Date().toISOString();
  const encounter: Encounter = {
    id: uuidv4(),
    status: "field_capture",
    acuity: "medium",
    createdAt: now,
    updatedAt: now,
    paramedicId: token.userId,
    paramedicName: token.name,
    rawTranscript: transcript,
    patientContext,
    // Seed a minimal structured shell so CRMs paint the chief complaint instantly;
    // the structuring agent fills vitals/observations as the pipeline runs.
    structuredData: {
      chiefComplaint: patient.chiefComplaint || "Incoming — pending assessment",
      vitals: {},
      observations: [],
      conditions: [],
      narrative: "",
    },
    triageStatus: "pending",
    nursingNotes: [],
    auditTrail: [
      createAuditEntry(
        "voice_capture",
        "DISPATCH_SEED",
        `911 dispatch (${token.name}) opened ${patientContext.name} — ${patient.chiefComplaint ?? "unspecified complaint"}. Broadcasting to all stations.`,
        token.userId,
        token.name
      ),
    ],
  };

  await upsertEncounter(encounter);   // broadcast: card appears everywhere
  setActiveSelection(encounter.id);   // broadcast: all tabs focus this patient

  // Fire the full AI pipeline without blocking the response — each stage streams
  // out over SSE as it completes (works locally; on serverless use a queue).
  if (autorun) {
    void runProgressivePipeline(encounter).catch((err) =>
      console.error("[seed] pipeline error:", err instanceof Error ? err.message : err)
    );
  }

  return NextResponse.json({ encounter, reused: false }, { headers: corsHeaders(origin) });
}
