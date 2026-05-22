# 911 Dispatch UI — Handoff Document

**Date:** 2026-05-22  
**Branch:** `ui-cleanup-phase1` (merged to PR, not yet merged to main)  
**App:** `apps/nine11` — the 911 Dispatch single-page Next.js app  
**Repo:** https://github.com/PranavAchar01/HealthFlow

---

## What Was Done

### Session 1 — UI Cleanup (COMPLETED + COMMITTED)

All 5 changes were implemented, verified with `tsc --noEmit` (zero errors), committed to branch `ui-cleanup-phase1`, pushed, and a PR was opened against `main`.

#### Change 1 — App name: GuestFlow → HealthFlow
- **`apps/nine11/src/app/layout.tsx` line 3:** Page `<title>` updated from `"GuestFlow 911 — Emergency Dispatch"` to `"HealthFlow 911 - Emergency Dispatch"`
- **`apps/nine11/src/app/page.tsx` line 152:** Breadcrumb nav `<span>` updated from `"GuestFlow"` to `"HealthFlow"`
- Variable names, file names, imports, and URL strings (e.g. `guestflow-doctor.vercel.app`) were intentionally left unchanged — display text only.

#### Change 2 — Top banner buttons
- **`apps/nine11/src/app/page.tsx` line 166:** Replaced the 4-button array `["NEW INCIDENT", "PATIENT HISTORY", "PRINT REPORT", "REFRESH"]` with `["Zoom In", "Zoom Out"]`
- Same `<button>` element, same className — no layout change.

#### Change 3 — Remove all emojis
Removed 7 Unicode emoji occurrences from display text:
- Nav right-side icons: `🔍🕐⚙` → plain text `Search`, `History`, `Settings`
- Launch button: `"🚨 Launch Emergency Pipeline"` → `"Launch Emergency Pipeline"`
- Continue To links: `🏥 Nurse Station` → `Nurse Station`, `👨‍⚕️ Doctor CRM` → `Doctor CRM`, `🚑 Paramedic View` → `Paramedic View`
- Empty state decorative `<div className="text-5xl mb-4">🚨</div>` — div removed entirely
- No lucide/heroicon icon components were touched.

#### Change 4 — Remove em dashes
- **`apps/nine11/src/app/layout.tsx`:** `"HealthFlow 911 — Emergency Dispatch"` → `"HealthFlow 911 - Emergency Dispatch"`
- **`apps/nine11/src/app/page.tsx` line 53:** SCENARIOS data `"Blunt Trauma — MVA"` → `"Blunt Trauma - MVA"`

#### Change 5 — Remove "Preferred Contact" field
- **`apps/nine11/src/app/page.tsx` line 223:** Removed the `<div>` containing `Preferred Contact` / `Secure Message` from the patient header card's flex row.
- `Language` and `Risk Level` fields remain untouched. `flex gap-6` container still intact.

---

### Git State

```
Branch: ui-cleanup-phase1
Commit: 24378be
PR URL: https://github.com/PranavAchar01/HealthFlow/pull/new/ui-cleanup-phase1
```

**Note:** The commit includes `package-lock.json` changes (side effect of running `npm install` to locate the TypeScript compiler during verification). These are valid lockfile changes, not broken. If you want a clean PR with only the 2 UI files, run:

```bash
git checkout main -- package-lock.json
git commit --amend --no-edit
git push --force-with-lease origin ui-cleanup-phase1
```

---

## What Was NOT Done (Interrupted — Next Session Work)

Session 2 was started but interrupted before any edits were made. The following 4 changes are fully specified and ready to implement. The current `page.tsx` was read in full — no edits were applied.

### Change 1 — Replace preset patients with 10 realistic records

**Current state:** 5 patients in `SCENARIOS` array, typed via `typeof SCENARIOS[0]` (inferred, not explicit).

**What needs to happen:**
1. Define an explicit `Patient` TypeScript type that extends the current shape with new optional fields.
2. Replace the 5 SCENARIOS with 10 patients.

**Required new fields on the type:**
```ts
type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

type TranscriptLine = {
  speaker: "Dispatcher" | "Caller";
  text: string;
};

type NotesSummary = {
  chiefComplaint: string;
  vitals?: string;
  patientHistory: string;
  currentMedications: string;
  allergies: string;
  callerRelationship: string;
  keyObservations: string;
  priority: string;
};

type Patient = {
  id: string;
  name: string;
  age: number | null;          // null for unknown patients
  sex: "M" | "F" | "Unknown";
  dob: string;                 // empty string for unknown
  patientId: string;           // empty for unknown
  phone: string;
  address: string;
  email: string;
  language: string;
  risk: "HIGH" | "MED" | "LOW" | "UNKNOWN";
  chiefComplaint: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  avatar: string;
  avatarBg: string;
  emergencyContact: EmergencyContact | null;
  note?: string;               // for unknown/minimal patients
  transcriptLines: TranscriptLine[];
  notesSummary: NotesSummary;
  isUnknownPatient: boolean;
};
```

**Required patient mix:**
- Priority: 3 HIGH, 2 MEDIUM, 2 LOW, 3 UNKNOWN
- 5-6 full-record patients: Bay Area/SF addresses, full demographics, emergency contacts
- 2-3 minimal/unknown patients: "Unknown Male, approx 40s" style names, empty medical data, `note` field explaining no ID available, `isUnknownPatient: true`
- Chief complaints (one each): suspected stroke, acute chest pain, blunt trauma MVA, diabetic emergency, suspected overdose, elderly fall, acute respiratory distress, pediatric emergency, unresponsive unknown cause, Good Samaritan unidentified

**Existing code that reads SCENARIOS fields and must still work:**
- `selected.name` — patient header `<h1>`
- `selected.chiefComplaint` — header subtitle + patient list
- `selected.avatar` / `selected.avatarBg` — avatar circle
- `selected.risk` — risk badge (update color map to handle "LOW" and "UNKNOWN")
- `selected.language` — header info row
- `selected.name`, `selected.patientId`, `selected.phone`, `selected.address`, `selected.email`, `selected.dob`, `selected.age`, `selected.sex` — Contact Info panel
- `selected.conditions` — Medical History section
- `selected.medications` / `selected.allergies` — Medications + Allergies section
- `selected.transcript` — currently a plain string; **must be migrated to `transcriptLines` array**
- `launchScenario` passes `scenario.transcript` to the API — update to join `transcriptLines` back into a string for the API call
- `typeof SCENARIOS[0]` type inference used in `useState` and `launchScenario` — replace with explicit `Patient` type

**Risk badge color map needs updating for "LOW" and "UNKNOWN"** (currently only handles HIGH/MED, falls through to green):
```tsx
// In patient list:
s.risk === "HIGH" ? "bg-red-100 text-red-700" :
s.risk === "MED" ? "bg-orange-100 text-orange-700" :
s.risk === "LOW" ? "bg-green-100 text-green-700" :
"bg-gray-100 text-gray-500"   // UNKNOWN

// In header badge:
selected.risk === "HIGH" ? "bg-red-500" :
selected.risk === "MED" ? "bg-orange-500" :
selected.risk === "LOW" ? "bg-green-500" :
"bg-gray-400"   // UNKNOWN
```

**Age display:** For unknown patients where `age` is null, show `"Unknown"` instead of `"null yo"` in the patient list.

---

### Change 2 — Emergency Contact section + functional Add button

**Location:** Contact Info panel (left column, `w-56` div), below the existing Medical History section.

**What to add:**
1. A new section header `"Emergency Contact"` matching the style of `"Medical History"` (teal, semibold, uppercase, xs)
2. Display: contact name, relationship, phone — or `"Not on file"` italic gray if null
3. A functional `"+ Add"` button on the section header (same `+` style as the existing Contact Info header button)

**Add button behavior:**
- For patients where `emergencyContact === null`, show the `+` button
- On click: expand an inline form directly inside the panel (no modal/page navigation)
- Inline form fields: Name, Relationship, Phone
- Form style: match existing panel field style — small text inputs, labeled, same xs/gray styling
- On submit: update the patient's `emergencyContact` in local React state (the `scenarios` array in state)
- No backend needed

**State change required:** `SCENARIOS` (currently a module-level `const`) needs to be lifted into `useState` so individual patient records can be mutated:
```tsx
const [scenarios, setScenarios] = useState<Patient[]>(SCENARIOS);
```
All references to `SCENARIOS.map(...)` and `SCENARIOS.length` update to `scenarios.map(...)` and `scenarios.length`.

**Inline form state:** Add a piece of state for which patient's emergency contact form is open:
```tsx
const [ecFormPatientId, setEcFormPatientId] = useState<string | null>(null);
const [ecForm, setEcForm] = useState({ name: "", relationship: "", phone: "" });
```

---

### Change 3 — Functional "+" on Contact Info header for incomplete patients

**Location:** The `+` button already exists at line 240:
```tsx
<button className="text-[#2563a8] text-lg leading-none">+</button>
```

**Current behavior:** Visually present but non-functional (no `onClick`).

**What to add:**
- For patients with `isUnknownPatient === true` (incomplete data): clicking `+` opens an inline form inside the Contact Info panel with fields: Full Name, Date of Birth, Phone, Address, Patient ID
- For patients with full records: hide or disable the button
- On submit: update that patient's record in the local `scenarios` state (same state lifted in Change 2)
- Inline form style: match the emergency contact form from Change 2

**Inline form state:**
```tsx
const [contactFormOpen, setContactFormOpen] = useState(false);
const [contactForm, setContactForm] = useState({ name: "", dob: "", phone: "", address: "", patientId: "" });
```

---

### Change 4 — Realistic 911 transcripts + wired Timeline/Notes tabs

**Transcript format (already defined in Change 1 type):**
```ts
transcriptLines: Array<{ speaker: "Dispatcher" | "Caller"; text: string }>
```

Each patient needs minimum 8 exchanges covering: address confirmation, symptom description, known history, dispatcher instructions, unit dispatch/ETA.

**Caller type distribution across 10 patients:**
- 2-3: patient calling themselves
- 2-3: friend/family
- 2-3: bystander/witness
- 1-2: Good Samaritan, unresponsive person found (these are the `isUnknownPatient` cases)

**Notes summary (already defined in Change 1 type):**
```ts
notesSummary: {
  chiefComplaint: string;
  vitals?: string;
  patientHistory: string;
  currentMedications: string;
  allergies: string;
  callerRelationship: string;
  keyObservations: string;
  priority: string;
}
```

**Tab wiring — current state:**
The Timeline/Notes tab buttons exist at line 276 but are purely visual — no state, no conditional rendering:
```tsx
{["Timeline","Notes"].map(t=><button key={t} className="text-xs text-gray-500 hover:text-gray-700">{t}</button>)}
```
The panel body always renders `selected.transcript` (the old plain string) at line 281.

**What to add:**
1. A state variable for the active tab:
   ```tsx
   const [activeTab, setActiveTab] = useState<"Timeline" | "Notes">("Timeline");
   ```
2. Wire the tab buttons to `setActiveTab` + add an active style:
   ```tsx
   className={`text-xs hover:text-gray-700 ${activeTab === t ? "text-[#2563a8] font-semibold border-b border-[#2563a8]" : "text-gray-500"}`}
   ```
3. Reset `activeTab` to `"Timeline"` when a new patient is selected (in `launchScenario`).
4. Replace the single `selected.transcript` display block with conditional rendering:
   - **Timeline tab:** Render `selected.transcriptLines` as a chat-style exchange list. Speaker label on left, colored differently for Dispatcher vs Caller.
   - **Notes tab:** Render `selected.notesSummary` as labeled key-value rows matching the panel field style.

**Timeline render pattern (suggested):**
```tsx
{selected.transcriptLines.map((line, i) => (
  <div key={i} className={`flex gap-2 mb-2 ${line.speaker === "Dispatcher" ? "flex-row" : "flex-row-reverse"}`}>
    <span className={`text-xs font-semibold flex-shrink-0 w-20 ${line.speaker === "Dispatcher" ? "text-[#2563a8]" : "text-gray-600"}`}>
      {line.speaker}
    </span>
    <p className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1 border border-gray-100 flex-1">{line.text}</p>
  </div>
))}
```

**Notes render pattern (suggested):**
```tsx
{Object.entries(selected.notesSummary).map(([key, val]) => val ? (
  <div key={key} className="mb-2">
    <p className="text-gray-400 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
    <p className="text-gray-800 font-medium text-xs">{val}</p>
  </div>
) : null)}
```

---

## Files Modified So Far

| File | Status |
|------|--------|
| `apps/nine11/src/app/layout.tsx` | Modified (Changes 1 + 4 from Session 1) |
| `apps/nine11/src/app/page.tsx` | Modified (Changes 1-5 from Session 1) |
| `package-lock.json` | Modified (side effect of npm install during tsc verification) |

## Files to Be Modified Next Session

| File | Changes needed |
|------|---------------|
| `apps/nine11/src/app/page.tsx` | All of Changes 1-4 from Session 2 — full rewrite of data layer and new UI components |

---

## TypeScript Verification Command

```bash
# From repo root:
node_modules/.bin/tsc --noEmit --project apps/nine11/tsconfig.json
# Exit 0 = clean
```

---

## Key Architectural Notes

- **No child components.** The entire 911 dispatch UI is one file: `apps/nine11/src/app/page.tsx`. There are no separate component files to import or update.
- **No shared packages consumed.** The `packages/` directory (e.g. `@guestflow/types`) is not imported by nine11.
- **State pattern:** `useState` only, no context or external store. All new state goes in the same `NineOneOne` component.
- **API call:** `launchScenario` sends `scenario.transcript` (a plain string) to `/api/agents/draft`. When `transcript` becomes `transcriptLines: TranscriptLine[]`, the API call must join them: `transcriptLines.map(l => \`\${l.speaker}: \${l.text}\`).join("\n")`.
- **Styling:** All Tailwind, no CSS modules. Color tokens: teal `#00a99d` for section headers, blue `#2563a8` for interactive elements, navy `#1e3f7a` for hover/nav.
