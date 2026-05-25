# HealthFlow Deployment Guide

---

## Monorepo Overview

HealthFlow is a Turborepo monorepo. Each app deploys as its own Vercel project.

| App | Directory | Port (local) | Purpose |
|-----|-----------|-------------|---------|
| API + Agents | `apps/api` | 3001 | All agent logic, REST API — **deploy first** |
| Paramedic UI | `apps/paramedic` | 3002 | Field voice capture |
| Doctor CRM | `apps/doctor` | 3003 | Physician review and approval |
| Nurse Dashboard | `apps/nurse` | 3004 | Triage queue and nursing protocol |
| 911 Dispatch | `apps/nine11` | 3005 | Dispatch call entry |

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/PranavAchar01/HealthFlow.git
cd HealthFlow

# 2. Install (all workspaces)
npm install

# 3. Configure
cp .env.example .env.local
# At minimum, fill in ANTHROPIC_API_KEY for LLM mode.
# Leave blank for rule-based fallback (works for demos).

# 4. Run everything
npm run dev
# API: http://localhost:3001
# Paramedic: http://localhost:3002
# Doctor: http://localhost:3003
# Nurse: http://localhost:3004
# 911 Dispatch: http://localhost:3005

# 5. Test the pipeline
curl -X POST http://localhost:3001/api/agents/draft \
  -H "Authorization: Bearer paramedic_sarah" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "68yo male, suspected stroke, left hemiparesis, onset 20 min ago, HR 92, BP 168/94"}'
```

---

## Vercel Deployment (Monorepo)

Each app gets its own Vercel project. Deploy the API first — all frontend apps depend on its URL.

### Step 1 — Deploy the API

1. Go to [vercel.com/new](https://vercel.com/new) → Import `PranavAchar01/HealthFlow`
2. Set **Root Directory** → `apps/api`
3. Framework preset: **Next.js** (auto-detected)
4. Add environment variables (see below)
5. Deploy → note the URL, e.g. `https://healthflow-api.vercel.app`

### Step 2 — Deploy frontend apps

Repeat for each frontend app. Set:
- **Root Directory** → `apps/paramedic` (or `apps/doctor`, etc.)
- **NEXT_PUBLIC_API_URL** → the API URL from Step 1

Each `apps/*/vercel.json` already has the correct build configuration.

---

## Environment Variables

### API service (`apps/api`)

#### Required for voice
| Variable | Where to get it |
|----------|----------------|
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API Keys |

#### Required for LLM agents (strongly recommended)
| Variable | Where to get it |
|----------|----------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `GEMINI_API_KEY` | aistudio.google.com → API Keys (alternative to Anthropic) |

Without either key, agents fall back to rule-based logic. The app works, but diagnosis and structuring quality is lower.

#### Production persistence (Supabase)
| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project → Settings → API |

Without these, the API uses an in-memory store that resets on each deployment. Fine for demos.

#### Optional integrations
| Variable | Purpose |
|----------|---------|
| `APIFY_API_TOKEN` | Live drug interaction data (falls back to built-in DB) |
| `ENTIRE_API_KEY` | External immutable audit via Entire.io |
| `SCALEKIT_ENV_URL` | Production SSO auth (falls back to demo tokens) |
| `SCALEKIT_CLIENT_ID` | |
| `SCALEKIT_CLIENT_SECRET` | |

### Frontend apps (`apps/paramedic`, `apps/doctor`, `apps/nurse`, `apps/nine11`)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your deployed API URL, e.g. `https://healthflow-api.vercel.app` |

---

## Setting Up Supabase (Production Persistence)

1. Create a project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run `apps/api/supabase/schema.sql`
3. Enable Realtime on the `encounters` table (already in schema)
4. Add the three Supabase env vars to the API's Vercel project

With Supabase configured, the in-memory store is automatically bypassed and encounters persist across deployments and lambda instances.

---

## Setting Up Scalekit Auth (Production)

Current auth uses demo tokens (`paramedic_sarah`, `dr_chen`, `nurse_rodriguez`). For hospital SSO:

1. Create a Scalekit environment at [scalekit.com](https://scalekit.com)
2. Add `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET` to the API app
3. Replace `apps/api/src/lib/auth.ts` with Scalekit SDK validation:

```typescript
import { ScalekitClient } from '@scalekit-sdk/node';

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL!,
  process.env.SCALEKIT_CLIENT_ID!,
  process.env.SCALEKIT_CLIENT_SECRET!
);

export async function validateToken(token: string): Promise<AuthToken | null> {
  try {
    const claims = await scalekit.validateToken(token);
    return mapClaimsToAuthToken(claims);
  } catch {
    return null;
  }
}
```

---

## Running Tests

```bash
# From repo root
npm test

# From apps/api
cd apps/api
npm test           # 24 unit tests, no API key required
npm run test:watch # watch mode
```

---

## Build Verification

Run before every deployment:

```bash
npm run build       # builds all apps via Turborepo
```

All pages should compile with no TypeScript errors.

---

## Production Checklist

- [ ] `ELEVENLABS_API_KEY` set on API Vercel project
- [ ] `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY`) set on API Vercel project
- [ ] `NEXT_PUBLIC_API_URL` set on all frontend Vercel projects
- [ ] Supabase project created and `schema.sql` applied (if persistence needed)
- [ ] Supabase env vars set on API Vercel project
- [ ] `npm run build` passes locally with zero errors
- [ ] `npm test` passes (24 unit tests)
- [ ] Test `/api/agents/draft` with stroke transcript post-deploy
- [ ] Verify Warfarin/tPA safety block triggers correctly
- [ ] Verify doctor approval flow end-to-end
