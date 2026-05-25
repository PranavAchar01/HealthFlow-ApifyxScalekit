import { runDiagnosisChain } from '../diagnosis-chain';
import { Encounter } from '@/types';

// When ANTHROPIC_API_KEY is absent, createChatModel returns null
// and runDiagnosisChain falls back to rule-based logic — no LLM call.

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: 'test-enc-001',
    status: 'diagnosis_complete',
    acuity: 'critical',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paramedicId: 'pm-001',
    paramedicName: 'Sarah Mitchell',
    rawTranscript: '',
    auditTrail: [],
    triageStatus: 'pending',
    nursingNotes: [],
    ...overrides,
  } as Encounter;
}

describe('runDiagnosisChain (fallback, no LLM)', () => {
  it('returns ischemic stroke diagnosis for stroke presentation', async () => {
    const enc = makeEncounter({
      structuredData: {
        chiefComplaint: 'Suspected Stroke',
        vitals: { heartRate: 92, bloodPressure: '168/94', spO2: 96, gcs: 13 },
        observations: [],
        conditions: [{ resourceType: 'Condition', code: 'I63.9', display: 'Cerebral Infarction', severity: 'severe' }],
        narrative: 'Stroke presentation',
      },
      patientContext: {
        patientId: 'PT-001', name: 'John Martinez', age: 68, sex: 'Male',
        allergies: ['Penicillin'], currentMedications: ['Warfarin 5mg'], conditions: ['Atrial Fibrillation'],
      },
    });

    const result = await runDiagnosisChain(enc);

    expect(result.primary).toContain('Stroke');
    expect(result.icdCode).toBe('I63.9');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.differentials.length).toBeGreaterThan(0);
    expect(result.reasoning).toBeTruthy();
  });

  it('returns STEMI diagnosis for chest pain presentation', async () => {
    const enc = makeEncounter({
      structuredData: {
        chiefComplaint: 'Chest Pain / Suspected MI',
        vitals: {},
        observations: [],
        conditions: [],
        narrative: 'Acute chest pain',
      },
      patientContext: {
        patientId: 'PT-002', name: 'Patricia Williams', age: 55, sex: 'Female',
        allergies: [], currentMedications: [], conditions: [],
      },
    });

    const result = await runDiagnosisChain(enc);

    expect(result.primary).toMatch(/MI|STEMI/);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('confidence is always between 0 and 1', async () => {
    const enc = makeEncounter({
      structuredData: {
        chiefComplaint: 'Unknown',
        vitals: {},
        observations: [],
        conditions: [],
        narrative: '',
      },
      patientContext: {
        patientId: 'PT-003', name: 'Unknown', age: 45, sex: 'Unknown',
        allergies: [], currentMedications: [], conditions: [],
      },
    });

    const result = await runDiagnosisChain(enc);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('falls back gracefully when no structuredData', async () => {
    const enc = makeEncounter();
    const result = await runDiagnosisChain(enc);
    expect(result.primary).toBeTruthy();
    expect(result.icdCode).toBeTruthy();
  });
});
