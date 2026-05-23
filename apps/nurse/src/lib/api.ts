/**
 * Nurse Station — data layer
 *
 * Reads directly from HealthFlow_transcript (Supabase).
 * Nursing notes and triage status write back to the same table.
 */
import { supabase } from '@healthflow/supabase';
import type { Encounter, NursingNote, PatientContext } from "@/types";

// ── Row → Encounter mapper ────────────────────────────────────────────────────

function parseJson<T>(v: unknown): T | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch { return undefined; } }
  return v as T;
}

function transcriptToEncounter(row: Record<string, unknown>): Encounter {
  const conditions   = typeof row.conditions  === 'string' ? row.conditions.split('|').filter(Boolean)            : [];
  const medications  = typeof row.medications === 'string' ? row.medications.split('|').filter(Boolean)           : [];
  const allergies    = typeof row.allergies   === 'string' ? (row.allergies as string).split('|').filter(Boolean) : [];

  const notesSummary = parseJson<Record<string, string>>(row.notesSummary) ?? {};

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
    nursingNotes         : parseJson<NursingNote[]>(row.nursingNotes)  ?? [],
    triageStatus         : (row.triageStatus as Encounter['triageStatus']) || 'pending',
    nurseId              : row.nurseId   as string | undefined,
    nurseName            : row.nurseName as string | undefined,
    approvedBy           : row.approvedBy    as string | undefined,
    approvedAt           : row.approvedAt    as string | undefined,
    physicianName        : row.physicianName  as string | undefined,
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
    console.error('[nurse] getEncounters Supabase error:', error);
    return [];
  }

  return (data as Record<string, unknown>[]).map(transcriptToEncounter);
}

/**
 * Append a nursing note to the patient's nursingNotes array in Supabase.
 * Returns the updated Encounter.
 */
export async function addNursingNote(
  encounterId : string,
  note        : string,
  category    : string
): Promise<Encounter> {
  // 1. Fetch current row to read existing notes
  const { data: current, error: fetchErr } = await supabase
    .from('HealthFlow_transcript')
    .select('nursingNotes, nurseId, nurseName')
    .eq('id', encounterId)
    .single();

  if (fetchErr || !current) throw new Error(`[nurse] addNursingNote fetch error: ${fetchErr?.message}`);

  const existingNotes: NursingNote[] = parseJson<NursingNote[]>(
    (current as Record<string, unknown>).nursingNotes
  ) ?? [];

  const newNote: NursingNote = {
    id        : crypto.randomUUID(),
    timestamp : new Date().toISOString(),
    nurseId   : 'nurse_rodriguez',
    nurseName : 'Maria Rodriguez, RN',
    note,
    category  : category as NursingNote['category'],
  };

  const updatedNotes = [...existingNotes, newNote];
  const now = new Date().toISOString();

  // 2. Write back
  const { data, error } = await supabase
    .from('HealthFlow_transcript')
    .update({
      nursingNotes : JSON.stringify(updatedNotes),
      nurseId      : 'nurse_rodriguez',
      nurseName    : 'Maria Rodriguez, RN',
      updatedAt    : now,
    })
    .eq('id', encounterId)
    .select()
    .single();

  if (error || !data) throw new Error(`[nurse] addNursingNote update error: ${error?.message}`);

  return transcriptToEncounter(data as Record<string, unknown>);
}

/**
 * Update triage status for a patient.
 * If status is 'escalated', also sets status → 'needs_doctor_approval'.
 */
export async function setTriageStatus(
  encounterId  : string,
  triageStatus : string
): Promise<Encounter> {
  const updates: Record<string, string> = {
    triageStatus,
    updatedAt : new Date().toISOString(),
  };
  if (triageStatus === 'escalated') {
    updates.status = 'needs_doctor_approval';
  }

  const { data, error } = await supabase
    .from('HealthFlow_transcript')
    .update(updates)
    .eq('id', encounterId)
    .select()
    .single();

  if (error || !data) throw new Error(`[nurse] setTriageStatus error: ${error?.message}`);

  return transcriptToEncounter(data as Record<string, unknown>);
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
