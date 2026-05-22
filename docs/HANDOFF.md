# HealthFlow Healthcare — Engineering Handoff

**Last Updated:** 2026-05-22  
**Status:** Production-ready, Vercel-deployable  
**Repo:** https://github.com/PranavAchar01/HealthFlow

---

## What This Is

A multi-agent AI pipeline that takes a paramedic's voice dictation in the field and produces physician-approved EHR orders in under 60 seconds. The pipeline runs 9 specialized agents in sequence, checks drug safety, surfaces conflicts in a real-time CRM dashboard, and commits approved orders under physician identity with a fully checksummed audit trail.

---

## System Overview

```
[Paramedic Field]
  └── Voice (ElevenLabs Scribe) → /api/voice/transcribe
        ↓
[Agent Pipeline] /api/agents/draft
  Agent 1:   Voice Capture      — auth + transcript binding
  Agent 2:   Structuring        — LangChain → FHIR R4 JSON
  Agent 2.5: Context Pull       — patient history + meds lookup
  Agent 7a:  Diagnosis          — LangChain → differential + ICD-10
  Agent 7c:  Action Planner     — LangChain → medication/imaging orders
  Agent 3:   Drug/Allergy Check — Apify mock → contraindication scan
  Agent 8:   Safety Controller  — blocks dangerous orders, adds alternatives
  Agent 9:   Case Supervisor    — acuity classification + CRM routing
        ↓
[CRM Dashboard] — 5 interconnected views (real-time polling)
  /crm           Command Center  (aggregate + approval)
  /crm/field     Field Ops       (paramedic tracking)
  /crm/doctor    Physician       (clinical review queue)
  /crm/audit     Audit Trail     (immutable SHA-256 log)
  /crm/admin     Admin           (users, metrics, config)
        ↓
[Doctor Approval] /api/agents/commit
  Agent 4: Identity/Auth — Scalekit physician token verify
  Agent 5: EHR Write     — atomic order commit under MD identity
  Agent 6: Audit         — Entire.io checkpoint with checksum chain
```

---

## File Structure

```
src/
├── agents/
│   ├── agent-pipeline.ts          # Main orchestrator — runs all 9 agents
│   └── chains/
│       ├── structuring-chain.ts   # LangChain: transcript → FHIR observations
│       ├── diagnosis-chain.ts     # LangChain: patient data → differential Dx
│       ├── action-planner-chain.ts # LangChain: diagnosis → draft orders
│       └── safety-chain.ts        # Drug/allergy check + safety controller
├── app/
│   ├── page.tsx                   # Landing page
│   ├── paramedic/page.tsx         # Paramedic voice capture UI
│   ├── crm/
│   │   ├── layout.tsx             # Shared CRM layout + nav
│   │   ├── page.tsx               # Command Center
│   │   ├── field/page.tsx         # Field Ops CRM
│   │   ├── doctor/page.tsx        # Physician Review CRM
│   │   ├── audit/page.tsx         # Audit Trail CRM
│   │   └── admin/page.tsx         # Admin Panel CRM
│   └── api/
│       ├── voice/transcribe/      # ElevenLabs STT proxy
│       ├── agents/draft/          # Run pipeline → create encounter
│       ├── agents/commit/         # Doctor approval → EHR write
│       ├── encounters/            # List + get encounters
│       └── auth/users/            # Demo user listing
├── components/
│   ├── crm/
│   │   ├── CrmNav.tsx             # Shared navigation across CRM views
│   │   ├── EncounterCard.tsx      # Sidebar encounter summary card
│   │   └── EncounterDetail.tsx    # Detail panel with tabs + approval
│   ├── paramedic/
│   │   └── VoiceCapture.tsx       # MediaRecorder → ElevenLabs → transcript
│   └── ui/
│       ├── StatusBadge.tsx        # Status + acuity badges
│       └── AgentTimeline.tsx      # Audit trail timeline component
├── lib/
│   ├── agent-pipeline.ts          # (legacy) inline pipeline helpers
│   ├── audit.ts                   # SHA-256 checksummed audit log
│   ├── auth.ts                    # Scalekit demo token validation
│   ├── store.ts                   # In-memory encounter store
│   └── supabase.ts                # Supabase client (production)
└── types/
    ├── index.ts                   # All shared TypeScript types
    └── speech.d.ts                # Web Speech API type declarations
```

---

## API Reference

### POST /api/voice/transcribe
Proxies audio to ElevenLabs Scribe v1.

**Request:** `multipart/form-data` with `audio` field (webm/mp4/wav)  
**Response:** `{ text: string, language_code: string, language_probability: number }`  
**Auth:** None (server-side key only)

---

### POST /api/agents/draft
Runs the full 9-agent pipeline on a field transcript.

**Headers:** `Authorization: Bearer paramedic_sarah`  
**Body:** `{ "transcript": "string" }`  
**Response:** Full `Encounter` object with audit trail  
**Required Permission:** `field_data_entry`

---

### POST /api/agents/commit
Physician approves orders and commits to EHR.

**Headers:** `Authorization: Bearer dr_chen`  
**Body:** `{ "encounterId": "uuid", "approvedOrderIds"?: ["uuid"] }`  
**Response:** Updated `Encounter` + EHR commit receipt  
**Required Permissions:** `cpoe`, `approve_orders`

---

### GET /api/encounters
List all encounters (newest first).

### GET /api/encounters/[id]
Get a single encounter by ID.

### GET /api/auth/users
List demo users and their token keys.

---

## Demo Auth Tokens

| Bearer Token | User | Role | Key Permissions |
|---|---|---|---|
| `paramedic_sarah` | Sarah Mitchell | Paramedic | `field_data_entry` |
| `dr_chen` | Dr. James Chen | Physician | `cpoe`, `approve_orders`, `ehr_write` |
| `admin_ops` | Admin Operations | Admin | `view_audit`, `manage_users` |

Pass as `Authorization: Bearer <token>` header.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ELEVENLABS_API_KEY` | **Yes** | ElevenLabs Scribe v1 STT |
| `ANTHROPIC_API_KEY` | Recommended | Powers LangChain agents (falls back to rule-based without it) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase for persistent storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service role |
| `APIFY_API_TOKEN` | Optional | Live drug interaction APIs (mock DB used without it) |
| `ENTIRE_API_KEY` | Optional | Entire.io external audit (local SHA-256 used without it) |

Without `ANTHROPIC_API_KEY`, all LangChain chains fall back to deterministic rule-based logic — the app remains fully functional for demos.

---

## LangChain Agent Architecture

Each AI agent is a `RunnableSequence`:

```typescript
RunnableSequence.from([
  ChatPromptTemplate,   // System + human message templates
  ChatAnthropic,        // Claude Sonnet backend
  StringOutputParser,   // Raw string
]) // → JSON.parse → typed result
```

All chains have **graceful fallbacks** — if the API key is missing or the LLM returns malformed JSON, they fall back to regex/rule-based parsing.

**Chain files:**
- `structuring-chain.ts` — extracts vitals, FHIR observations, ICD-10 conditions
- `diagnosis-chain.ts` — generates differential diagnosis with confidence score
- `action-planner-chain.ts` — drafts medication, imaging, lab, consult, procedure orders
- `safety-chain.ts` — pure logic (no LLM): drug interaction table + safety controller

---

## Data Model

The central `Encounter` type flows through the entire pipeline:

```typescript
interface Encounter {
  id: string;
  status: EncounterStatus;       // field_capture → ... → committed
  acuity: AcuityLevel;           // low | medium | high | critical
  paramedicId/Name: string;
  rawTranscript: string;
  structuredData?: {              // Agent 2 output
    chiefComplaint, vitals, observations: FHIRObservation[], conditions: FHIRCondition[]
  };
  patientContext?: PatientContext; // Agent 2.5 output
  diagnosis?: DiagnosisResult;   // Agent 7a output
  draftOrders?: DraftOrder[];    // Agent 7c + 3 + 8 output
  safetyFlags?: DrugConflict[];  // Agent 3 output
  approvedBy/At, physicianName;  // Agent 4+5 output
  auditTrail: AuditEntry[];      // All agents append here
}
```

---

## Known Limitations & Next Steps

### Current Limitations
- **In-memory store** — all encounter data resets on server restart. Wire in Supabase (schema at `supabase/schema.sql`) for persistence.
- **Mock patient DB** — `agentContextPull()` returns a hardcoded patient. Connect to real EHR or FHIR server.
- **Mock Apify** — drug interaction table is local. Connect `APIFY_API_TOKEN` and implement live actor calls.
- **Demo auth** — Scalekit tokens are string literals. Replace with real Scalekit SDK for production SSO.
- **No real-time push** — CRM polls every 2s. Replace with Supabase Realtime subscriptions.

### Recommended Next Steps
1. **Supabase persistence** — run `supabase/schema.sql`, update `store.ts` to use Supabase client
2. **Supabase Realtime** — replace `setInterval` polling in CRM pages with `supabase.channel()` subscriptions
3. **Real Scalekit auth** — swap `src/lib/auth.ts` for `@scalekit-sdk/nextjs`
4. **Live Apify actor** — implement `POST https://api.apify.com/v2/acts/{actor}/runs` in `safety-chain.ts`
5. **FHIR server integration** — replace mock patient DB with real FHIR R4 server calls
6. **ElevenLabs TTS** — add voice readback for physician summary using ElevenLabs TTS API

---

## Deployment

### Vercel (Recommended)
1. Connect `PranavAchar01/HealthFlow` to Vercel
2. Add environment variables in Vercel project settings
3. Deploy — zero configuration needed

### Local Development
```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev                   # http://localhost:3000
```

### Build Check
```bash
npm run build   # must pass before deploying
```
