import { runActionPlannerChain } from '../action-planner-chain';
import { Encounter } from '@/types';

// Without ANTHROPIC_API_KEY, runActionPlannerChain uses the rule-based fallback.

function makeStrokeEncounter(): Encounter {
  return {
    id: 'test-enc-stroke',
    status: 'order_drafted',
    acuity: 'critical',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paramedicId: 'pm-001',
    paramedicName: 'Sarah Mitchell',
    rawTranscript: '',
    auditTrail: [],
    triageStatus: 'pending',
    nursingNotes: [],
    structuredData: {
      chiefComplaint: 'Suspected Stroke',
      vitals: {},
      observations: [],
      conditions: [],
      narrative: '',
    },
    patientContext: {
      patientId: 'PT-001', name: 'John Martinez', age: 68, sex: 'Male',
      allergies: ['Penicillin'],
      currentMedications: ['Warfarin 5mg daily'],
      conditions: ['Atrial Fibrillation'],
    },
    diagnosis: {
      primary: 'Ischemic Stroke (Large Vessel Occlusion)',
      icdCode: 'I63.9',
      confidence: 0.89,
      differentials: [{ condition: 'Hemorrhagic Stroke', probability: 0.08 }],
      reasoning: 'Left-side hemiparesis with AF.',
    },
  } as Encounter;
}

describe('runActionPlannerChain (fallback, no LLM)', () => {
  it('drafts orders for a stroke patient', async () => {
    const orders = await runActionPlannerChain(makeStrokeEncounter());

    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.id)).toBe(true);
    expect(orders.every((o) => o.status === 'drafted')).toBe(true);
  });

  it('includes a tPA medication order for stroke', async () => {
    const orders = await runActionPlannerChain(makeStrokeEncounter());

    const tpa = orders.find((o) => o.medication?.medication.toLowerCase().includes('tpa') || o.medication?.medication.toLowerCase().includes('alteplase'));
    expect(tpa).toBeDefined();
    expect(tpa?.type).toBe('medication');
    expect(tpa?.urgency).toBe('stat');
  });

  it('includes imaging and consult orders for stroke', async () => {
    const orders = await runActionPlannerChain(makeStrokeEncounter());

    const types = orders.map((o) => o.type);
    expect(types).toContain('imaging');
    expect(types).toContain('consult');
  });

  it('all medication orders have a MedicationRequest structure', async () => {
    const orders = await runActionPlannerChain(makeStrokeEncounter());

    for (const o of orders.filter((x) => x.type === 'medication')) {
      expect(o.medication).toBeDefined();
      expect(o.medication?.resourceType).toBe('MedicationRequest');
      expect(o.medication?.medication).toBeTruthy();
      expect(o.medication?.dosage).toBeTruthy();
      expect(o.medication?.route).toBeTruthy();
    }
  });

  it('returns empty array when encounter has no diagnosis', async () => {
    const enc = makeStrokeEncounter();
    delete (enc as Partial<Encounter>).diagnosis;
    const orders = await runActionPlannerChain(enc);
    expect(Array.isArray(orders)).toBe(true);
  });
});
