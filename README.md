# GuestFlow

**Multi-Agent Healthcare AI Pipeline -- Field to EHR in 60 Seconds**

A 9-agent pipeline that captures paramedic voice data, runs AI diagnostics, checks drug interactions, and commits physician-approved orders to the EHR with immutable audit at every step.

## Architecture

```
Paramedic (Voice) -> Agent 1: Voice Capture -> Agent 2: Structuring -> Agent 2.5: Context Pull
    -> Agent 7a: Diagnosis -> Agent 7c: Action Planner -> Agent 3: Drug/Allergy Check (Apify)
    -> Agent 8: Safety Controller -> Agent 9: Case Supervisor -> CRM Dashboard
    -> Doctor Approval -> Agent 4: Identity/Auth -> Agent 5: EHR Write -> Agent 6: Audit
```

### Agent Pipeline

| Agent | Role | Description |
|-------|------|-------------|
| 1 | Voice Capture | Web Speech API transcription with Scalekit paramedic auth |
| 2 | Structuring | NLP extraction of vitals, FHIR observations, conditions |
| 2.5 | Context Pull | Patient history, current medications, allergies from EHR |
| 7a | Diagnosis | Differential diagnosis with ICD-10 codes and confidence scoring |
| 7c | Action Planner | Draft medication, imaging, procedure, lab, and consult orders |
| 3 | Drug/Allergy Check | Apify-powered contraindication and allergy screening |
| 8 | Safety Controller | Block dangerous orders, suggest safe alternatives |
| 9 | Case Supervisor | Acuity classification and routing to CRM |
| 4 | Identity/Auth | Scalekit physician verification with CPOE rights |
| 5 | EHR Write | Atomic commit of approved orders under physician authority |
| 6 | Immutable Audit | Entire.io-style SHA-256 checksummed audit trail |

## Demo Scenario

The default demo simulates a critical stroke case:

1. **Paramedic Sarah Mitchell** dictates: patient with left-side paralysis, suspected stroke
2. **AI diagnoses** Ischemic Stroke at 89% confidence
3. **Action Planner** drafts tPA order
4. **Apify Drug Check** catches that patient is on **Warfarin** -- tPA is **contraindicated** (fatal hemorrhage risk)
5. **Safety Controller** blocks tPA and recommends **mechanical thrombectomy**
6. **Dr. James Chen** reviews on CRM dashboard and approves safe orders
7. Orders committed to EHR with full audit trail

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Pages

- `/` -- Landing page with pipeline visualization
- `/paramedic` -- Paramedic field interface with voice capture
- `/crm` -- Hospital CRM dashboard for physician review and approval

### API Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/agents/draft` | Paramedic token | Submit transcript, run full agent pipeline |
| POST | `/api/agents/commit` | Physician token | Approve orders and commit to EHR |
| GET | `/api/encounters` | -- | List all encounters |
| GET | `/api/encounters/[id]` | -- | Get single encounter |
| GET | `/api/auth/users` | -- | List demo users and tokens |

### Demo Authentication

The app ships with demo auth tokens (simulating Scalekit):

| Token | User | Role | Permissions |
|-------|------|------|-------------|
| `paramedic_sarah` | Sarah Mitchell | Paramedic | field_data_entry |
| `dr_chen` | Dr. James Chen | Physician | cpoe, approve_orders, ehr_write |

Pass as `Authorization: Bearer <token>` header.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Scalekit (demo mode with mock tokens)
- **Database**: In-memory store (Supabase schema included for production)
- **Drug Safety**: Apify actor simulation (mock contraindication DB)
- **Audit**: Entire.io-style SHA-256 checksummed immutable log
- **Voice**: Web Speech API
- **Data Format**: FHIR R4 observations, conditions, medication requests
- **Deployment**: Vercel

## Environment Variables

Copy `.env.example` to `.env.local`. All integrations are optional -- the app works fully with built-in mocks.

## Database Schema

For production with Supabase, run `supabase/schema.sql`.

## Project Structure

```
src/
  agents/         # Agent pipeline orchestrator (all 9 agents)
  app/
    api/agents/   # Draft and commit API routes
    crm/          # CRM dashboard page
    paramedic/    # Paramedic voice capture page
  components/
    crm/          # CRM-specific components
    paramedic/    # Voice capture component
    ui/           # Shared UI components
  lib/            # Auth, audit, store, Supabase client
  types/          # TypeScript type definitions
supabase/         # Database schema SQL
```
