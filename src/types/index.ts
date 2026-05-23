export type AgentRole =
  | "voice_capture"
  | "structuring"
  | "context_pull"
  | "diagnosis"
  | "guidelines"
  | "action_planner"
  | "drug_allergy_check"
  | "safety_controller"
  | "case_supervisor"
  | "identity_auth"
  | "ehr_write"
  | "audit";

export type EncounterStatus =
  | "field_capture"
  | "structuring"
  | "context_loaded"
  | "diagnosis_complete"
  | "order_drafted"
  | "safety_flagged"
  | "needs_doctor_approval"
  | "approved"
  | "committed"
  | "rejected";

export type AcuityLevel = "low" | "medium" | "high" | "critical";

export interface Vitals {
  heartRate?: number;
  bloodPressure?: string;
  spO2?: number;
  respiratoryRate?: number;
  temperature?: number;
  gcs?: number;
  painScale?: number;
}

export interface FHIRObservation {
  resourceType: "Observation";
  code: string;
  display: string;
  value: string | number;
  unit?: string;
  timestamp: string;
}

export interface FHIRCondition {
  resourceType: "Condition";
  code: string;
  display: string;
  severity: string;
  onsetDateTime?: string;
}

export interface FHIRMedicationRequest {
  resourceType: "MedicationRequest";
  medication: string;
  dosage: string;
  route: string;
  status: "draft" | "active" | "cancelled" | "blocked";
  reason?: string;
  contraindication?: string;
}

export interface PatientContext {
  patientId: string;
  name: string;
  age: number;
  sex: string;
  allergies: string[];
  currentMedications: string[];
  conditions: string[];
  recentLabs?: Record<string, string>;
}

export interface DrugConflict {
  drug: string;
  conflictsWith: string;
  severity: "warning" | "critical" | "contraindicated";
  description: string;
  alternative?: string;
}

export interface DiagnosisResult {
  primary: string;
  icdCode: string;
  confidence: number;
  differentials: Array<{ condition: string; probability: number }>;
  reasoning: string;
}

export interface GuidelineResult {
  condition: string;
  source: string;            // e.g. "AHA/ASA 2019 Stroke Guidelines"
  recommendations: Array<{
    text: string;
    class: string;           // recommendation class, e.g. "Class I"
    evidenceLevel: string;   // level of evidence, e.g. "Level A"
  }>;
  timeWindow?: string;       // e.g. "tPA within 4.5h of onset"
  redFlags: string[];        // contraindication cues the planner/safety must heed
  summary: string;
}

export interface DraftOrder {
  id: string;
  type: "medication" | "procedure" | "imaging" | "lab" | "consult";
  description: string;
  urgency: "routine" | "urgent" | "stat";
  medication?: FHIRMedicationRequest;
  status: "drafted" | "blocked" | "approved" | "executed";
  conflicts?: DrugConflict[];
  safetyNotes?: string;
  alternative?: string;
}

export interface Encounter {
  id: string;
  status: EncounterStatus;
  acuity: AcuityLevel;
  createdAt: string;
  updatedAt: string;

  // Phase 1: Field capture
  paramedicId: string;
  paramedicName: string;
  rawTranscript: string;

  // Phase 2: Structured data
  structuredData?: {
    chiefComplaint: string;
    vitals: Vitals;
    observations: FHIRObservation[];
    conditions: FHIRCondition[];
    narrative: string;
  };

  // Phase 2.5: Patient context
  patientContext?: PatientContext;

  // Phase 3: Diagnosis
  diagnosis?: DiagnosisResult;

  // Phase 3: Evidence-based guidelines (Agent 7b)
  guidelines?: GuidelineResult;

  // Phase 3: Orders
  draftOrders?: DraftOrder[];

  // Phase 4: Safety
  safetyFlags?: DrugConflict[];
  safetyRecommendation?: string;

  // Phase 5: Approval
  approvedBy?: string;
  approvedAt?: string;
  physicianName?: string;

  // Phase 6: Audit
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  agentRole: AgentRole;
  action: string;
  details: string;
  userId?: string;
  userName?: string;
  checksum?: string;
}

export interface AuthToken {
  userId: string;
  name: string;
  role: "paramedic" | "physician" | "admin";
  permissions: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface AgentResult<T = unknown> {
  agentRole: AgentRole;
  success: boolean;
  data?: T;
  error?: string;
  processingTimeMs: number;
  auditEntry: AuditEntry;
}
