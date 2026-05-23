import { Encounter, AuditEntry, NursingNote, NursingCarePlan } from "@/types";
import { createServerSupabase } from "@/lib/supabase";

// In-memory fallback (per-lambda) — used only when Supabase is not configured.
// On Vercel, module state does NOT persist across lambda instances, so any
// multi-step handoff (paramedic → nurse → doctor) requires the Supabase path
// for reliable cross-instance updates. With pure in-memory, real-time only
// works for clients that happen to share the same warm lambda.
// In-process pub/sub for SSE broadcasts. One subscriber per connected client.
type Listener = (event: StoreEvent) => void;
export type StoreEvent =
  | { type: "upsert"; encounter: Encounter }
  | { type: "delete"; id: string }
  | { type: "select"; id: string | null };

// Pin the in-memory store, pub/sub listeners, and active selection to globalThis.
// Next.js dev re-evaluates modules per route bundle, which would otherwise fork
// these singletons — the SSE listeners registered by /stream would live in a
// different instance than the publish() called by /seed, and real-time updates
// would silently stop flowing between routes. globalThis keeps one shared copy.
type HealthflowStore = {
  memory: Map<string, Encounter>;
  listeners: Set<Listener>;
  activeSelectionId: string | null;
};
const globalRef = globalThis as unknown as { __healthflowStore?: HealthflowStore };
const store: HealthflowStore =
  globalRef.__healthflowStore ??
  (globalRef.__healthflowStore = { memory: new Map(), listeners: new Set(), activeSelectionId: null });

const memory = store.memory;

export function subscribe(listener: Listener): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function publish(event: StoreEvent) {
  for (const listener of store.listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[store] listener error:", err);
    }
  }
}

// The patient currently "in focus" across every connected CRM. When a 911
// dispatcher (or any station) selects a patient, this is broadcast so all open
// tabs jump to the same encounter at once.
export function getActiveSelection(): string | null {
  return store.activeSelectionId;
}

export function setActiveSelection(id: string | null) {
  store.activeSelectionId = id;
  publish({ type: "select", id });
}

const TABLE = "encounters";

type EncounterRow = {
  id: string;
  status: Encounter["status"];
  acuity: Encounter["acuity"];
  created_at: string;
  updated_at: string;
  paramedic_id: string;
  paramedic_name: string;
  raw_transcript: string;
  structured_data: Encounter["structuredData"] | null;
  patient_context: Encounter["patientContext"] | null;
  diagnosis: Encounter["diagnosis"] | null;
  draft_orders: Encounter["draftOrders"] | null;
  safety_flags: Encounter["safetyFlags"] | null;
  safety_recommendation: string | null;
  nurse_assessment: Encounter["nurseAssessment"] | null;
  nursing_care_plan: NursingCarePlan | null;
  nursing_notes: NursingNote[] | null;
  triage_status: Encounter["triageStatus"] | null;
  nurse_id: string | null;
  nurse_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  physician_name: string | null;
  audit_trail: AuditEntry[];
};

function rowToEncounter(r: EncounterRow): Encounter {
  return {
    id: r.id,
    status: r.status,
    acuity: r.acuity,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    paramedicId: r.paramedic_id,
    paramedicName: r.paramedic_name,
    rawTranscript: r.raw_transcript,
    structuredData: r.structured_data ?? undefined,
    patientContext: r.patient_context ?? undefined,
    diagnosis: r.diagnosis ?? undefined,
    draftOrders: r.draft_orders ?? undefined,
    safetyFlags: r.safety_flags ?? undefined,
    safetyRecommendation: r.safety_recommendation ?? undefined,
    nurseAssessment: r.nurse_assessment ?? undefined,
    nursingCarePlan: r.nursing_care_plan ?? undefined,
    nursingNotes: r.nursing_notes ?? undefined,
    triageStatus: r.triage_status ?? undefined,
    nurseId: r.nurse_id ?? undefined,
    nurseName: r.nurse_name ?? undefined,
    approvedBy: r.approved_by ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    physicianName: r.physician_name ?? undefined,
    auditTrail: r.audit_trail ?? [],
  };
}

function encounterToRow(e: Encounter): EncounterRow {
  return {
    id: e.id,
    status: e.status,
    acuity: e.acuity,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    paramedic_id: e.paramedicId,
    paramedic_name: e.paramedicName,
    raw_transcript: e.rawTranscript,
    structured_data: e.structuredData ?? null,
    patient_context: e.patientContext ?? null,
    diagnosis: e.diagnosis ?? null,
    draft_orders: e.draftOrders ?? null,
    safety_flags: e.safetyFlags ?? null,
    safety_recommendation: e.safetyRecommendation ?? null,
    nurse_assessment: e.nurseAssessment ?? null,
    nursing_care_plan: e.nursingCarePlan ?? null,
    nursing_notes: e.nursingNotes ?? null,
    triage_status: e.triageStatus ?? null,
    nurse_id: e.nurseId ?? null,
    nurse_name: e.nurseName ?? null,
    approved_by: e.approvedBy ?? null,
    approved_at: e.approvedAt ?? null,
    physician_name: e.physicianName ?? null,
    audit_trail: e.auditTrail,
  };
}

export async function getEncounter(id: string): Promise<Encounter | undefined> {
  const sb = createServerSupabase();
  if (sb) {
    const { data, error } = await sb.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[store] getEncounter error:", error.message);
      return memory.get(id);
    }
    if (!data) return undefined;
    return rowToEncounter(data as EncounterRow);
  }
  return memory.get(id);
}

export async function getAllEncounters(): Promise<Encounter[]> {
  const sb = createServerSupabase();
  if (sb) {
    const { data, error } = await sb.from(TABLE).select("*").order("updated_at", { ascending: false });
    if (error) {
      console.error("[store] getAllEncounters error:", error.message);
      return Array.from(memory.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return (data as EncounterRow[]).map(rowToEncounter);
  }
  return Array.from(memory.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function upsertEncounter(encounter: Encounter): Promise<Encounter> {
  encounter.updatedAt = new Date().toISOString();
  // Always keep the local mirror updated so SSE has the freshest copy without an extra read.
  memory.set(encounter.id, encounter);

  const sb = createServerSupabase();
  if (sb) {
    const { error } = await sb.from(TABLE).upsert(encounterToRow(encounter));
    if (error) {
      console.error("[store] Supabase upsert failed, using memory only:", error.message);
    }
  }

  publish({ type: "upsert", encounter });
  return encounter;
}

export async function deleteEncounter(id: string): Promise<boolean> {
  const sb = createServerSupabase();
  if (sb) {
    const { error } = await sb.from(TABLE).delete().eq("id", id);
    if (!error) {
      memory.delete(id);
      publish({ type: "delete", id });
      return true;
    }
    return false;
  }
  const ok = memory.delete(id);
  if (ok) publish({ type: "delete", id });
  return ok;
}
