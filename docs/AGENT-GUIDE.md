# HealthFlow Agent Guide

This document describes each agent in the pipeline, its inputs/outputs, LangChain integration, and how to extend or replace it.

---

## Agent 1 — Voice Capture

**File:** `src/agents/agent-pipeline.ts` → `agentVoiceCapture()`  
**Engine:** Client-side MediaRecorder + ElevenLabs Scribe v1  
**Auth:** Scalekit paramedic token validated before execution

**Flow:**
```
Browser (MediaRecorder) → POST /api/voice/transcribe → ElevenLabs API → text
                     → POST /api/agents/draft (with transcript) → Agent 1 logs + validates
```

**What it does:**
- Binds the transcript to the authenticated paramedic's identity in the audit log
- Creates the first checksum entry proving who provided the raw data

**To extend:** Replace `src/app/api/voice/transcribe/route.ts` to support other STT providers (Whisper, Deepgram, Google STT). The route accepts any audio format ElevenLabs supports (webm, mp4, wav, m4a).

---

## Agent 2 — Structuring

**File:** `src/agents/chains/structuring-chain.ts`  
**Engine:** LangChain `RunnableSequence` → Claude Sonnet  
**Fallback:** Regex-based NLP extraction

**Input:** Raw transcript string  
**Output:** `Encounter["structuredData"]`
```typescript
{
  chiefComplaint: string,
  vitals: { heartRate, bloodPressure, spO2, temperature, respiratoryRate, gcs },
  observations: FHIRObservation[],   // LOINC codes
  conditions: FHIRCondition[],       // ICD-10 codes
  narrative: string
}
```

**Prompt strategy:** Single-shot JSON extraction with explicit schema in system prompt. Temperature 0 for deterministic output.

**To extend:** Add more LOINC observation codes, extend the system prompt schema, or swap Claude for a fine-tuned medical NLP model.

---

## Agent 2.5 — Context Pull

**File:** `src/agents/agent-pipeline.ts` → `agentContextPull()`  
**Engine:** Mock FHIR patient DB (in-memory)

**Input:** None (uses default patient in demo)  
**Output:** `PatientContext`
```typescript
{
  patientId, name, age, sex,
  allergies: string[],
  currentMedications: string[],
  conditions: string[],
  recentLabs: Record<string, string>
}
```

**To connect to real EHR:**
```typescript
// Replace MOCK_PATIENT_DB lookup with:
const response = await fetch(`${FHIR_SERVER}/Patient/${patientId}/$everything`);
const bundle = await response.json();
return parseFHIRBundle(bundle);
```

---

## Agent 7a — Diagnosis

**File:** `src/agents/chains/diagnosis-chain.ts`  
**Engine:** LangChain → Claude Sonnet  
**Fallback:** Keyword-based condition detection

**Input:** Structured encounter data (vitals, observations, patient history)  
**Output:** `DiagnosisResult`
```typescript
{
  primary: string,          // e.g. "Ischemic Stroke (Large Vessel Occlusion)"
  icdCode: string,          // e.g. "I63.9"
  confidence: number,       // 0.0–1.0
  differentials: [{ condition, probability }],
  reasoning: string
}
```

**Prompt strategy:** Full clinical context passed in human message. Model is instructed to weigh patient history (e.g. AF → cardioembolic stroke risk) against presenting symptoms.

**To extend:** Add RAG over clinical guidelines (UpToDate, AHA guidelines) as additional context in the human message.

---

## Agent 7b — Guidelines

**Status:** Planned (not yet implemented)  
**Purpose:** Fetch evidence-based treatment guidelines for the diagnosed condition  
**Integration point:** Between Agent 7a and 7c in `agent-pipeline.ts`

---

## Agent 7c — Action Planner

**File:** `src/agents/chains/action-planner-chain.ts`  
**Engine:** LangChain → Claude Sonnet  
**Fallback:** Hard-coded order sets per condition

**Input:** Diagnosis + patient context  
**Output:** `DraftOrder[]`

Order types: `medication | procedure | imaging | lab | consult`  
Urgency levels: `routine | urgent | stat`

**Key behavior:** The model drafts orders based on standard protocols. In the demo, a stroke diagnosis generates:
- tPA (blocked by safety check)
- CT Angiogram (stat imaging)
- Code Stroke activation (consult)
- CBC/BMP/INR labs

---

## Agent 3 — Drug/Allergy Check

**File:** `src/agents/chains/safety-chain.ts` → `runDrugAllergyCheck()`  
**Engine:** Local interaction table (Apify mock)

**Input:** `DraftOrder[]` + `PatientContext`  
**Output:** `{ orders: DraftOrder[], conflicts: DrugConflict[] }`

**Interaction table (current):**
| Drug | Conflicts With | Severity |
|------|---------------|----------|
| tPA | Warfarin | Contraindicated |
| Aspirin | Warfarin | Critical |
| Ibuprofen | Warfarin | Warning |

**To connect Apify:**
```typescript
const run = await fetch('https://api.apify.com/v2/acts/{drug-interaction-actor}/runs', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.APIFY_API_TOKEN}` },
  body: JSON.stringify({ drugs: orderDrugs, patientMeds: currentMeds })
});
```

---

## Agent 8 — Safety Controller

**File:** `src/agents/chains/safety-chain.ts` → `runSafetyController()`  
**Engine:** Pure logic (no LLM)

**Input:** Orders + conflicts from Agent 3  
**Output:** Updated orders (blocked ones stay blocked) + recommendation string

**Behavior:**
- Contraindicated orders: status → `"blocked"`, alternative appended as new draft order
- Critical conflicts: recommendation flags for physician attention
- Clear: passes through with approval note

---

## Agent 9 — Case Supervisor

**File:** `src/agents/agent-pipeline.ts` → `agentCaseSupervisor()`  
**Engine:** Rule-based routing logic

**Input:** Full encounter state  
**Output:** `{ acuity: "low"|"medium"|"high"|"critical", routeTo: string }`

**Routing logic:**
- Blocked orders OR severe conditions → `critical` → `crm_aggregate_ui`
- Diagnosis confidence > 70% → `high` → `crm_aggregate_ui`
- Otherwise → `medium` → `general_queue`

---

## Agent 4 — Identity/Auth

**File:** `src/app/api/agents/commit/route.ts`  
**Engine:** Scalekit token validation

**Input:** `Authorization: Bearer dr_chen` header  
**Validates:** `cpoe` + `approve_orders` permissions  
**Rejects:** Paramedic tokens, missing tokens, tokens without CPOE rights

---

## Agent 5 — EHR Write

**File:** `src/app/api/agents/commit/route.ts`  
**Engine:** In-memory store update (mock EHR)

**What it does:**
- Sets approved order statuses to `"active"`
- Records physician identity and approval timestamp on the encounter
- Sets encounter status to `"committed"`

**To connect a real EHR:**
```typescript
// FHIR R4 bundle write
await fetch(`${EHR_FHIR_SERVER}/Bundle`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ehrToken}`, 'Content-Type': 'application/fhir+json' },
  body: JSON.stringify(buildFHIRBundle(encounter, approvedOrders, physician))
});
```

---

## Agent 6 — Immutable Audit

**File:** `src/lib/audit.ts`  
**Engine:** Local SHA-256 checksums (Entire.io mock)

Every `AuditEntry` gets a SHA-256 checksum of its content (excluding the checksum field itself):

```typescript
entry.checksum = crypto
  .createHash("sha256")
  .update(JSON.stringify({ ...entry, checksum: undefined }))
  .digest("hex");
```

**To connect Entire.io:**
```typescript
await fetch('https://api.entire.io/v1/checkpoint', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.ENTIRE_API_KEY}` },
  body: JSON.stringify({ encounterId, entries: encounter.auditTrail })
});
```

---

## Adding a New Agent

1. Create `src/agents/chains/your-agent-chain.ts`
2. Export a `runYourAgent(encounter: Encounter): Promise<YourOutput>` function
3. Add an `AgentRole` literal to `src/types/index.ts`
4. Import and call in `src/agents/agent-pipeline.ts` at the right pipeline position
5. Add an audit entry with `createAuditEntry("your_role", "ACTION", "details")`
6. Push the entry to `encounter.auditTrail`
