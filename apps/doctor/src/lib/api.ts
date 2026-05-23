/**
 * Doctor CRM — data layer
 *
 * Reads directly from HealthFlow_transcript (Supabase).
 * Approval writes back to the same table.
 * The REST API (apps/api) is no longer required for reads/approvals;
 * it is kept for the pipeline trigger path only.
 */
import { supabase } from '@healthflow/supabase';
import type { Encounter, PatientContext } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DOCTOR_TOKEN = "dr_chen";
const DOCTOR_NAME  = "Dr. James Chen";

// ── Row → Encounter mapper ────────────────────────────────────────────────────

function parseJson<T>(v: unknown): T | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch { return undefined; } }
  return v as T;
}

function transcriptToEncounter(row: Record<string, unknown>): Encounter {
  const conditions   = typeof row.conditions  === 'string' ? row.conditions.split('|').filter(Boolean)           : [];
  const medications  = typeof row.medications === 'string' ? row.medications.split('|').filter(Boolean)          : [];
  const allergies    = typeof row.allergies   === 'string' ? (row.allergies as string).split('|').filter(Boolean) : [];

  const notesSummary = parseJson<Record<string, string>>(row.notesSummary) ?? {};

  // Prefer the pipeline-written structuredData column; fall back to notesSummary
  const structuredData: Encounter['structuredData'] =
    parseJson<Encounter['structuredData']>(row.structuredData) ?? {
      chiefComplaint : (row.chiefComplaint as string) || notesSummary.chiefComplaint || '',
      vitals         : {},
      observations   : [],
      conditions     : [],
      narrative      : notesSummary.keyObservations || '',
    };

  const patientContext: PatientContext = {
    patientId          : (row.patientId as string) || String(row.id),
    name               : (row.name      as string) || 'Unknown',
    age                : typeof row.age === 'number' ? row.age : 0,
    sex                : (row.sex as string) === 'M' ? 'Male'
                       : (row.sex as string) === 'F' ? 'Female'
                       : ((row.sex as string) || 'Unknown'),
    allergies,
    currentMedications : medications,
    conditions,
  };

  const now = new Date().toISOString();

  const transcriptLines = parseJson<Array<{speaker: string; text: string}>>(row.transcriptLines) ?? [];
  const rawTranscript = transcriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n');

  return {
    id              : String(row.id),
    status          : (row.status as Encounter['status']) || 'field_capture',
    acuity          : (row.acuity  as Encounter['acuity']) || 'medium',
    createdAt       : (row.createdAt as string) || now,
    updatedAt       : (row.updatedAt as string) || now,
    paramedicId     : 'dispatch',
    paramedicName   : 'Dispatch',
    rawTranscript,
    structuredData,
    patientContext,
    diagnosis            : parseJson<Encounter['diagnosis']>(row.diagnosis),
    draftOrders          : parseJson<Encounter['draftOrders']>(row.draftOrders),
    safetyFlags          : parseJson<Encounter['safetyFlags']>(row.safetyFlags),
    safetyRecommendation : row.safetyRecommendation as string | undefined,
    approvedBy           : row.approvedBy   as string | undefined,
    approvedAt           : row.approvedAt   as string | undefined,
    physicianName        : row.physicianName as string | undefined,
    auditTrail           : parseJson<Encounter['auditTrail']>(row.auditTrail) ?? [],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch all patients from HealthFlow_transcript, mapped to Encounter objects. */
export async function getEncounters(): Promise<Encounter[]> {
  const { data, error } = await supabase
    .from('HealthFlow_transcript')
    .select('*')
    .order('id', { ascending: true });

  if (error || !data) {
    console.error('[doctor] getEncounters Supabase error:', error);
    return [];
  }

  return (data as Record<string, unknown>[]).map(transcriptToEncounter);
}

/**
 * Approve a patient's draft orders.
 * Writes approval fields directly to HealthFlow_transcript (no API hop needed).
 */
export async function commitEncounter(
  patientId: string
): Promise<{ encounter: Encounter; ehrCommit: unknown }> {
  const approvedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('HealthFlow_transcript')
    .update({
      approvedBy    : DOCTOR_TOKEN,
      approvedAt,
      physicianName : DOCTOR_NAME,
      status        : 'committed',
      updatedAt     : approvedAt,
    })
    .eq('id', patientId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Supabase commit error: ${error?.message ?? 'No data returned'}`);
  }

  const encounter = transcriptToEncounter(data as Record<string, unknown>);

  return {
    encounter,
    ehrCommit: {
      physicianId   : DOCTOR_TOKEN,
      physicianName : DOCTOR_NAME,
      timestamp     : approvedAt,
    },
  };
}

export async function getDemoUsers(): Promise<unknown[]> {
  try {
    const res = await fetch(`${API_URL}/api/auth/users`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DOCTOR_TOKEN}` },
    });
    const data = await res.json();
    return data.users ?? [];
  } catch { return []; }
}

// ── Stream subscription (no-op — 3 s polling in the page handles freshness) ──

export type EncounterStreamHandlers = {
  onSnapshot : (encounters: Encounter[]) => void;
  onUpsert   : (encounter: Encounter)   => void;
  onDelete?  : (id: string)             => void;
  onError?   : (err: Event)             => void;
};

/** SSE is replaced by Supabase polling. Returns a no-op disposer. */
export function subscribeToEncounters(_handlers: EncounterStreamHandlers): () => void {
  return () => {};
}
