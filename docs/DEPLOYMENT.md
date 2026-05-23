# HealthFlow Deployment Guide

---

## Quick Deploy (Vercel)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `PranavAchar01/HealthFlow`
3. Add environment variables (see below)
4. Click Deploy

No build configuration needed — Next.js is auto-detected.

---

## Environment Variables for Production

Set these in Vercel → Project → Settings → Environment Variables:

### Required
| Variable | Where to get it |
|---|---|
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API Keys |

### Strongly Recommended
| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

Without `ANTHROPIC_API_KEY`, agents fall back to rule-based logic. The app works but diagnosis and structuring quality is lower.

### For Production Persistence (Supabase)
| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |

### Optional Integrations
| Variable | Purpose |
|---|---|
| `APIFY_API_TOKEN` | Live drug interaction data via Apify actors |
| `ENTIRE_API_KEY` | External immutable audit via Entire.io |

---

## Setting Up Supabase (Production Persistence)

The app currently uses an in-memory store that resets on each server restart. For production:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run `supabase/schema.sql`
3. Enable Realtime for the `encounters` table (already in schema)
4. Add the three Supabase env vars to Vercel
5. Update `src/lib/store.ts` to use the Supabase client:

```typescript
// Replace upsertEncounter with:
export async function upsertEncounter(encounter: Encounter) {
  const supabase = createServerSupabase();
  await supabase.from('encounters').upsert({
    id: encounter.id,
    status: encounter.status,
    // ... map all fields
  });
  return encounter;
}
```

### Supabase Realtime (Replace Polling)

Replace the `setInterval` polling in each CRM page with:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('encounters')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'encounters' }, 
      (payload) => setEncounters(prev => updateList(prev, payload)))
    .subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

---

## Setting Up Scalekit Auth (Production)

Current auth is demo tokens (`paramedic_sarah`, `dr_chen`). For production SSO:

1. Create a Scalekit environment at [scalekit.com](https://scalekit.com)
2. Add env vars: `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`
3. Replace `src/lib/auth.ts` with Scalekit SDK validation:

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

## Local Development

```bash
# 1. Clone
git clone https://github.com/PranavAchar01/HealthFlow.git
cd HealthFlow

# 2. Install
npm install

# 3. Configure
cp .env.example .env.local
# Edit .env.local — add ELEVENLABS_API_KEY and ANTHROPIC_API_KEY

# 4. Run
npm run dev
# → http://localhost:3000

# 5. Test the pipeline
curl -X POST http://localhost:3000/api/agents/draft \
  -H "Authorization: Bearer paramedic_sarah" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "68yo male, suspected stroke, left hemiparesis, onset 20 min ago, HR 92, BP 168/94"}'
```

---

## Build Verification

Always run before deploying:

```bash
npm run build
```

Expected output:
```
Route (app)
├ ○ /
├ ○ /crm
├ ○ /crm/admin
├ ○ /crm/audit
├ ○ /crm/doctor
├ ○ /crm/field
├ ○ /paramedic
├ ƒ /api/agents/commit
├ ƒ /api/agents/draft
├ ƒ /api/voice/transcribe
└ ...
```

All pages should be `○ (Static)` or `ƒ (Dynamic)` with no errors.

---

## Vercel Production Checklist

- [ ] `ELEVENLABS_API_KEY` added to Vercel env vars
- [ ] `ANTHROPIC_API_KEY` added to Vercel env vars
- [ ] Supabase project created and schema applied (if persistence needed)
- [ ] Supabase env vars added to Vercel
- [ ] `npm run build` passes locally
- [ ] Test `/api/agents/draft` with a sample transcript post-deploy
- [ ] Verify `/crm` loads and shows real-time encounter polling
- [ ] Verify doctor approval flow end-to-end
