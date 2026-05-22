# GuestFlow CRM Architecture

The CRM is split into five independent but interconnected views, all sharing a common layout, navigation, and data layer via the `/api/encounters` endpoint.

---

## CRM Topology

```
                    ┌─────────────────────────────┐
                    │       Shared Layout          │
                    │  (CrmNav + System Status)    │
                    └─────────────┬───────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                        │
   ┌──────▼──────┐   ┌──────────▼──────────┐   ┌────────▼────────┐
   │  /crm       │   │  /crm/field          │   │  /crm/doctor    │
   │  Command    │   │  Field Operations    │   │  Physician      │
   │  Center     │   │  (Paramedic tracker) │   │  Review Queue   │
   └─────────────┘   └─────────────────────┘   └─────────────────┘
          │                       │                        │
   ┌──────▼──────┐   ┌──────────▼──────────┐
   │  /crm/audit │   │  /crm/admin          │
   │  Audit Trail│   │  System Admin        │
   │  (SHA-256)  │   │  (Users + Metrics)   │
   └─────────────┘   └─────────────────────┘
```

All views share:
- Common header (slate-900 bar with system status)
- `CrmNav` tab bar with active route highlighting
- `GET /api/encounters` as data source (polled every 2–5s)

---

## View Reference

### `/crm` — Command Center
**Audience:** Charge nurse, senior physician, operations lead  
**Purpose:** Aggregate overview with approval capability

Features:
- 5 stat cards (Total, Pending, In Pipeline, Committed, Critical)
- Red alert banner when physician approval is needed
- Sidebar encounter list split by status
- Full encounter detail panel with approve button
- Real-time polling every 2s

---

### `/crm/field` — Field Operations
**Audience:** Dispatch coordinator, field supervisor  
**Purpose:** Track active paramedic units and field data quality

Features:
- Active field units table (all non-committed encounters)
- Paramedic identity, chief complaint, patient name, acuity, status
- 3 aggregate metrics: transcript volume, safety flags, avg agents per encounter
- "Open Field Interface" button links to `/paramedic`
- Polling every 3s

---

### `/crm/doctor` — Physician Review
**Audience:** Attending physicians  
**Purpose:** Dedicated clinical review queue with minimal distractions

Features:
- Pending queue (red, pulsing for critical cases)
- Green "All clear" state when no pending cases
- Reviewed encounters list
- Full encounter detail with approve button (same as command center)
- Safety alerts prominently displayed
- Polling every 2s

---

### `/crm/audit` — Audit Trail
**Audience:** Compliance officer, risk management, legal  
**Purpose:** Immutable record of every agent action with cryptographic verification

Features:
- Global stats: total entries, checksummed entries, encounters tracked, agent types
- Encounter selector to filter by case
- Raw audit table: time, agent role, action, user, checksum prefix
- Agent timeline view (emoji + description for each step)
- Polling every 5s

Checksum format: SHA-256 of `JSON.stringify({ ...entry, checksum: undefined })`

---

### `/crm/admin` — Admin Panel
**Audience:** System administrator, DevOps  
**Purpose:** User management, agent metrics, system config, CRM topology status

Features:
- Registered users with token keys and permissions (Scalekit)
- Agent execution counts per role (bar chart)
- System configuration table (engine, auth, audit provider, etc.)
- CRM topology with live status for all 5 views

---

## Data Flow

All CRM views are read-only except Command Center and Doctor (which call `/api/agents/commit`).

```
/api/encounters  ──→  All CRM views (polling)
                            │
          approval action   ↓
/api/agents/commit  ←──  /crm or /crm/doctor
                            │
                         encounter status: "committed"
                            │
                         reflected in all views on next poll
```

---

## Extending the CRM

### Adding a new CRM view

1. Create `src/app/crm/your-view/page.tsx`
2. Add to `NAV_ITEMS` in `src/components/crm/CrmNav.tsx`:
   ```typescript
   { href: "/crm/your-view", label: "Your View", icon: "🏥", role: "Description" }
   ```
3. Fetch encounters from `/api/encounters` as needed
4. The shared layout and nav apply automatically

### Replacing polling with Supabase Realtime

In each CRM page, replace:
```typescript
const interval = setInterval(fetchEncounters, 2000);
```

With:
```typescript
const channel = supabase
  .channel('encounters-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'encounters' },
    (payload) => { /* update state */ })
  .subscribe();
```
