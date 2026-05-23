import { AgentResult, PatientContext } from "@/types";
import { createAuditEntry } from "@/lib/audit";

/**
 * Agent 2.5 — Context Pull (non-sequential lookup)
 *
 * Retrieves patient history, current medications, and allergies. In the demo
 * this reads a mock FHIR patient DB. To connect a real EHR, replace the lookup
 * with a FHIR `$everything` call (see docs/AGENT-GUIDE.md).
 *
 * The default patient (John Martinez, on Warfarin) is the one that makes the
 * tPA contraindication demo fire — keep it as the default.
 */
const MOCK_PATIENT_DB: Record<string, PatientContext> = {
  default: {
    patientId: "PT-20240001",
    name: "John Martinez",
    age: 68,
    sex: "Male",
    allergies: ["Penicillin"],
    currentMedications: ["Warfarin 5mg daily", "Lisinopril 10mg daily", "Metformin 500mg BID"],
    conditions: ["Atrial Fibrillation", "Hypertension", "Type 2 Diabetes"],
    recentLabs: {
      INR: "2.8 (therapeutic range 2.0-3.0)",
      glucose: "142 mg/dL",
      creatinine: "1.1 mg/dL",
    },
  },
  // A second patient with no anticoagulation — useful to show a "clears safety" path.
  "PT-20240002": {
    patientId: "PT-20240002",
    name: "Maria Lopez",
    age: 54,
    sex: "Female",
    allergies: [],
    currentMedications: ["Atorvastatin 20mg daily"],
    conditions: ["Hyperlipidemia"],
    recentLabs: {
      INR: "1.0 (normal)",
      glucose: "98 mg/dL",
      creatinine: "0.9 mg/dL",
    },
  },
};

export function agentContextPull(patientId: string = "default"): AgentResult<PatientContext> {
  const start = Date.now();
  const patient = MOCK_PATIENT_DB[patientId] ?? MOCK_PATIENT_DB.default;
  const audit = createAuditEntry(
    "context_pull",
    "CONTEXT_PULL",
    `Retrieved patient context for ${patient.name} (${patient.patientId}). Current medications: ${patient.currentMedications.join(", ")}`
  );
  return {
    agentRole: "context_pull",
    success: true,
    data: patient,
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}
