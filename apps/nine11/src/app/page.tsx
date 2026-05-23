"use client";
import { useState, useEffect, useRef } from "react";
import { INITIAL_PATIENTS, type Patient, type EmergencyContact } from "./data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type EncounterResult = {
  id: string; status: string; acuity: string;
  chiefComplaint?: string; diagnosis?: string; confidence?: number;
  safetyFlags: number; orders: number; auditEntries: number;
};

type StreamEncounter = {
  id: string; status: string; acuity: string;
  structuredData?: { chiefComplaint?: string };
  diagnosis?: { primary?: string; confidence?: number };
  safetyFlags?: unknown[]; draftOrders?: unknown[]; auditTrail?: unknown[];
};

const resultFromEncounter = (e: StreamEncounter): EncounterResult => ({
  id: e.id, status: e.status, acuity: e.acuity,
  chiefComplaint: e.structuredData?.chiefComplaint,
  diagnosis: e.diagnosis?.primary,
  confidence: e.diagnosis?.confidence,
  safetyFlags: e.safetyFlags?.length ?? 0,
  orders: e.draftOrders?.length ?? 0,
  auditEntries: e.auditTrail?.length ?? 0,
});

const riskBadgeList = (risk: string) =>
  risk === "HIGH" ? "bg-red-100 text-red-700" :
  risk === "MED"  ? "bg-orange-100 text-orange-700" :
  risk === "LOW"  ? "bg-green-100 text-green-700" :
  "bg-gray-100 text-gray-500";

const riskBadgeHeader = (risk: string) =>
  risk === "HIGH" ? "bg-red-500" :
  risk === "MED"  ? "bg-orange-500" :
  risk === "LOW"  ? "bg-green-500" :
  "bg-gray-400";

const inputCls = "w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#2563a8]";

export default function NineOneOne() {
  const [scenarios, setScenarios] = useState<Patient[]>(INITIAL_PATIENTS);
  const [selected, setSelected]   = useState<Patient | null>(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<EncounterResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "notes">("timeline");

  const [showECForm, setShowECForm]           = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [ecDraft, setEcDraft]                 = useState<EmergencyContact>({ name: "", relationship: "", phone: "" });
  const [contactDraft, setContactDraft]       = useState({ name: "", dob: "", phone: "", address: "", patientId: "" });

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Live mirror of the encounter we just dispatched — the right-panel pipeline
  // status fills in as the AI agents run and stream back over SSE.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const es = new EventSource(`${API_URL}/api/encounters/stream`);
    es.addEventListener("snapshot", (ev) => {
      try {
        const { encounters, selectedId } = JSON.parse((ev as MessageEvent).data) as { encounters: StreamEncounter[]; selectedId?: string | null };
        if (selectedId) {
          setActiveId(selectedId);
          const e = encounters.find((x) => x.id === selectedId);
          if (e) setResult(resultFromEncounter(e));
        }
      } catch {}
    });
    es.addEventListener("upsert", (ev) => {
      try {
        const e = JSON.parse((ev as MessageEvent).data) as StreamEncounter;
        if (activeIdRef.current === e.id) setResult(resultFromEncounter(e));
      } catch {}
    });
    es.addEventListener("select", (ev) => {
      try { const { id } = JSON.parse((ev as MessageEvent).data) as { id: string | null }; if (id) setActiveId(id); } catch {}
    });
    return () => es.close();
  }, []);

  const selectPatient = (s: Patient) => {
    setSelected(s);
    setActiveTab("timeline");
    setShowECForm(false);
    setShowContactForm(false);
    setResult(null);
    setError(null);
    setEcDraft({ name: "", relationship: "", phone: "" });
    setContactDraft({ name: "", dob: "", phone: "", address: "", patientId: "" });
    // Clicking a patient instantly dispatches them to every station + auto-runs the pipeline.
    seedScenario(s);
  };

  const updateScenario = (updated: Patient) => {
    setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelected(updated);
  };

  const saveEmergencyContact = () => {
    if (!selected || !ecDraft.name.trim()) return;
    updateScenario({ ...selected, emergencyContact: { ...ecDraft } });
    setShowECForm(false);
    setEcDraft({ name: "", relationship: "", phone: "" });
  };

  const saveContactInfo = () => {
    if (!selected) return;
    const patch: Partial<Patient> = {};
    if (contactDraft.name.trim())      patch.name      = contactDraft.name.trim();
    if (contactDraft.dob.trim())       patch.dob       = contactDraft.dob.trim();
    if (contactDraft.phone.trim())     patch.phone     = contactDraft.phone.trim();
    if (contactDraft.address.trim())   patch.address   = contactDraft.address.trim();
    if (contactDraft.patientId.trim()) patch.patientId = contactDraft.patientId.trim();
    if (Object.keys(patch).length > 0) patch.hasFullData = true;
    updateScenario({ ...selected, ...patch });
    setShowContactForm(false);
    setContactDraft({ name: "", dob: "", phone: "", address: "", patientId: "" });
  };

  // Dispatch a patient: create/refocus the shared encounter, broadcast it to every
  // open CRM, and auto-run the AI pipeline. Status then streams back in via SSE.
  const seedScenario = async (scenario: Patient) => {
    setLoading(true);
    setError(null);
    try {
      const transcriptText = scenario.transcriptExchanges
        .map(e => `${e.speaker}: ${e.text}`)
        .join("\n");
      const res = await fetch(`${API_URL}/api/encounters/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer paramedic_sarah" },
        body: JSON.stringify({
          patient: {
            patientId: scenario.patientId,
            name: scenario.name,
            age: scenario.age,
            sex: scenario.sex,
            allergies: scenario.allergies,
            medications: scenario.medications,
            conditions: scenario.conditions,
            chiefComplaint: scenario.chiefComplaint,
          },
          transcript: transcriptText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveId(data.encounter.id);
      setResult(resultFromEncounter(data.encounter));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setLoading(false);
    }
  };

  // Re-broadcast the active selection so any station opened late jumps to this patient.
  const refocusAllStations = async () => {
    if (!activeId) return;
    try {
      await fetch(`${API_URL}/api/encounters/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer paramedic_sarah" },
        body: JSON.stringify({ id: activeId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-focus failed");
    }
  };

  const NURSE_URL  = process.env.NEXT_PUBLIC_NURSE_URL       ?? "https://nurse-seven.vercel.app";
  const DOCTOR_URL = process.env.NEXT_PUBLIC_DOCTOR_CRM_URL  ?? "https://guestflow-doctor.vercel.app";

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Nav */}
      <nav className="bg-[#1e3f7a] text-white flex items-center h-10 px-3 gap-3 flex-shrink-0">
        <div className="grid grid-cols-3 gap-0.5 w-5 h-5 flex-shrink-0">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-white rounded-sm opacity-80" />
          ))}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="opacity-70">HealthFlow</span>
          <span className="opacity-40 mx-1">›</span>
          <span className="opacity-70">Emergency</span>
          <span className="opacity-40 mx-1">›</span>
          <span className="font-semibold">911 Dispatch</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm opacity-80">
          <span>Search</span><span>Time</span><span>Settings</span>
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">D</div>
        </div>
      </nav>

      {/* Action Bar */}
      <div className="bg-[#2563a8] text-white flex items-center h-9 px-4 gap-1 flex-shrink-0">
        {["Zoom In", "Zoom Out"].map(btn => (
          <button key={btn} className="flex items-center gap-1.5 text-xs font-medium px-3 h-7 rounded border border-white/20 hover:bg-white/10 transition-colors">
            {btn}
          </button>
        ))}
        <div className="ml-auto text-xs opacity-70">
          Dispatcher: Sarah Mitchell · Unit 42 · {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left: Patient List */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2">
          <div className="bg-white border border-gray-200 rounded">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <span className="text-[#00a99d] font-semibold text-xs tracking-wide uppercase">Preset Patients</span>
              <span className="text-gray-400 text-xs">{scenarios.length} records</span>
            </div>
            <div className="divide-y divide-gray-100">
              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectPatient(s)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5 ${selected?.id === s.id ? "bg-blue-50 border-l-2 border-l-[#2563a8]" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full ${s.avatarBg} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                    {s.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">{s.name}</p>
                    <p className="text-gray-500 text-xs truncate">
                      {s.age ? `${s.age}yo` : "Age unknown"} · {s.chiefComplaint}
                    </p>
                  </div>
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${riskBadgeList(s.risk)}`}>
                    {s.risk}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Patient Detail */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {selected ? (
            <>
              {/* Patient header */}
              <div className="bg-white border border-gray-200 rounded p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-full ${selected.avatarBg} text-white flex items-center justify-center text-xl font-bold flex-shrink-0`}>
                    {selected.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">PATIENT</p>
                    <h1 className="text-2xl font-bold text-gray-900">{selected.name}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{selected.chiefComplaint}</p>
                  </div>
                  <div className="flex gap-6 text-sm flex-shrink-0">
                    <div>
                      <p className="text-gray-400 text-xs">Language</p>
                      <p className="font-medium">{selected.language}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Risk Level</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${riskBadgeHeader(selected.risk)}`}>
                        {selected.risk}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Three-column detail */}
              <div className="flex gap-3 flex-1 min-h-0">

                {/* Left: Contact Info */}
                <div className="w-60 flex-shrink-0">
                  <div className="bg-white border border-gray-200 rounded h-full flex flex-col overflow-hidden">
                    {/* Contact Info header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Contact Info</span>
                      {!selected.hasFullData ? (
                        <button
                          onClick={() => setShowContactForm(v => !v)}
                          className="text-[#2563a8] text-lg leading-none hover:text-[#1e3f7a]"
                          title="Add patient info"
                        >+</button>
                      ) : (
                        <span className="text-gray-200 text-lg leading-none select-none" title="Record complete">+</span>
                      )}
                    </div>

                    <div className="overflow-y-auto flex-1">
                      {/* Patient note for unknown patients */}
                      {selected.note && (
                        <div className="mx-3 mt-2 mb-1 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                          {selected.note}
                        </div>
                      )}

                      {/* Contact info form (for low-data patients) */}
                      {showContactForm && (
                        <div className="mx-3 mt-2 mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-[#2563a8] font-semibold text-xs uppercase tracking-wide mb-2">Add Patient Info</p>
                          <div className="space-y-1.5">
                            <input placeholder="Full Name" value={contactDraft.name}
                              onChange={e => setContactDraft(d => ({ ...d, name: e.target.value }))}
                              className={inputCls} />
                            <input placeholder="Date of Birth (MM/DD/YYYY)" value={contactDraft.dob}
                              onChange={e => setContactDraft(d => ({ ...d, dob: e.target.value }))}
                              className={inputCls} />
                            <input placeholder="Phone" value={contactDraft.phone}
                              onChange={e => setContactDraft(d => ({ ...d, phone: e.target.value }))}
                              className={inputCls} />
                            <input placeholder="Address" value={contactDraft.address}
                              onChange={e => setContactDraft(d => ({ ...d, address: e.target.value }))}
                              className={inputCls} />
                            <input placeholder="Patient ID" value={contactDraft.patientId}
                              onChange={e => setContactDraft(d => ({ ...d, patientId: e.target.value }))}
                              className={inputCls} />
                            <div className="flex gap-1 pt-1">
                              <button onClick={saveContactInfo}
                                className="flex-1 py-1 bg-[#2563a8] text-white text-xs rounded hover:bg-[#1e3f7a] transition-colors">
                                Save
                              </button>
                              <button onClick={() => setShowContactForm(false)}
                                className="flex-1 py-1 border border-gray-200 text-gray-600 text-xs rounded hover:bg-gray-100 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Core contact fields */}
                      <div className="px-3 py-2 space-y-2 text-xs">
                        {([
                          ["Full Name", selected.name],
                          selected.patientId ? ["Patient ID", selected.patientId] : null,
                          selected.phone     ? ["Cell Phone", selected.phone]     : null,
                          selected.address   ? ["Address", selected.address]      : null,
                          selected.email     ? ["Email", selected.email]          : null,
                          selected.dob       ? ["Date of Birth", `${selected.dob}${selected.age ? ` (${selected.age})` : ""}`] : null,
                          selected.sex       ? ["Sex", selected.sex === "M" ? "Male" : "Female"] : null,
                        ] as (string[] | null)[]).filter((x): x is string[] => !!x).map(([label, val]) => (
                          <div key={label}>
                            <p className="text-gray-400">{label}</p>
                            <p className="text-gray-800 font-medium break-words">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Medical History */}
                      <div className="border-t border-gray-100 px-3 py-2">
                        <p className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide mb-2">Medical History</p>
                        {selected.conditions.length > 0 ? selected.conditions.map(c => (
                          <div key={c} className="text-xs text-gray-700 flex items-center gap-1 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            {c}
                          </div>
                        )) : <p className="text-xs text-gray-400 italic">No prior conditions on record</p>}
                      </div>

                      {/* Emergency Contact */}
                      <div className="border-t border-gray-100 px-3 py-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Emergency Contact</p>
                          {!showECForm && (
                            <button
                              onClick={() => setShowECForm(true)}
                              className="text-[#2563a8] text-xs font-semibold hover:text-[#1e3f7a]"
                            >
                              {selected.emergencyContact ? "Edit" : "+ Add"}
                            </button>
                          )}
                        </div>

                        {showECForm ? (
                          <div className="space-y-1.5">
                            <input placeholder="Name" value={ecDraft.name}
                              onChange={e => setEcDraft(d => ({ ...d, name: e.target.value }))}
                              className={inputCls} />
                            <input placeholder="Relationship" value={ecDraft.relationship}
                              onChange={e => setEcDraft(d => ({ ...d, relationship: e.target.value }))}
                              className={inputCls} />
                            <input placeholder="Phone" value={ecDraft.phone}
                              onChange={e => setEcDraft(d => ({ ...d, phone: e.target.value }))}
                              className={inputCls} />
                            <div className="flex gap-1 pt-1">
                              <button onClick={saveEmergencyContact}
                                className="flex-1 py-1 bg-[#2563a8] text-white text-xs rounded hover:bg-[#1e3f7a] transition-colors">
                                Save
                              </button>
                              <button onClick={() => setShowECForm(false)}
                                className="flex-1 py-1 border border-gray-200 text-gray-600 text-xs rounded hover:bg-gray-100 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : selected.emergencyContact ? (
                          <div className="space-y-1 text-xs">
                            <div>
                              <p className="text-gray-400">Name</p>
                              <p className="text-gray-800 font-medium">{selected.emergencyContact.name}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Relationship</p>
                              <p className="text-gray-800 font-medium">{selected.emergencyContact.relationship}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Phone</p>
                              <p className="text-gray-800 font-medium">{selected.emergencyContact.phone}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No emergency contact on record</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center: Transcript / Notes */}
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-gray-200 rounded h-full flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Field Transcript</span>
                      <div className="flex gap-3">
                        {(["timeline", "notes"] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={`text-xs capitalize transition-colors ${
                              activeTab === t
                                ? "text-gray-900 font-semibold border-b border-gray-800"
                                : "text-gray-400 hover:text-gray-600"
                            }`}
                          >
                            {t === "timeline" ? "Timeline" : "Notes"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 flex-1 overflow-y-auto flex flex-col">
                      {/* Timeline tab */}
                      {activeTab === "timeline" && (
                        <div className="space-y-2 mb-3">
                          {selected.transcriptExchanges.map((ex, i) => (
                            <div key={i} className={`flex ${ex.speaker === "Dispatcher" ? "justify-start" : "justify-end"}`}>
                              <div className={`max-w-[88%] rounded p-2 text-xs ${
                                ex.speaker === "Dispatcher"
                                  ? "bg-blue-50 border border-blue-100 text-blue-900"
                                  : "bg-gray-50 border border-gray-200 text-gray-800"
                              }`}>
                                <p className="font-semibold text-xs mb-0.5 opacity-60">{ex.speaker}</p>
                                <p className="leading-relaxed">{ex.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Notes tab */}
                      {activeTab === "notes" && (
                        <div className="bg-gray-50 rounded border border-gray-200 p-3 mb-3 space-y-2.5 text-xs">
                          {([
                            ["Chief Complaint", selected.notesSummary.chiefComplaint],
                            selected.notesSummary.vitals ? ["Vitals / Presentation", selected.notesSummary.vitals] : null,
                            ["Patient History", selected.notesSummary.patientHistory],
                            ["Current Medications", selected.notesSummary.currentMedications],
                            ["Allergies", selected.notesSummary.allergies],
                            ["Caller", selected.notesSummary.callerRelationship],
                            ["Key Observations", selected.notesSummary.keyObservations],
                            ["Priority", selected.notesSummary.priority],
                          ] as (string[] | null)[]).filter((x): x is string[] => !!x).map(([label, val]) => (
                            <div key={label}>
                              <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{label}</p>
                              <p className="text-gray-800 mt-0.5 leading-relaxed">{val}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Medications + Allergies */}
                      <div className="grid grid-cols-2 gap-3 mb-3 mt-auto">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Current Medications</p>
                          {selected.medications.length > 0 ? selected.medications.map(m => (
                            <div key={m} className="text-xs text-gray-700 flex items-center gap-1 mb-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                              {m}
                            </div>
                          )) : <p className="text-xs text-gray-400 italic">None on record</p>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Allergies</p>
                          {selected.allergies.length > 0 ? selected.allergies.map(a => (
                            <div key={a} className="text-xs text-red-700 flex items-center gap-1 mb-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                              {a}
                            </div>
                          )) : <p className="text-xs text-gray-400 italic">None known</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                        <span className="relative flex h-2 w-2 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                        </span>
                        {loading
                          ? "Dispatching to all stations…"
                          : "Dispatched live — nurse, paramedic & doctor are synced to this patient."}
                      </div>
                      <button
                        onClick={refocusAllStations}
                        disabled={!activeId || loading}
                        className="w-full py-2.5 bg-[#2563a8] hover:bg-[#1e3f7a] text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Dispatching...
                          </>
                        ) : "Re-broadcast to All Stations"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Pipeline Result */}
                <div className="w-56 flex-shrink-0 space-y-3">
                  <div className="bg-white border border-gray-200 rounded">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Pipeline Status</span>
                    </div>
                    {result ? (
                      <div className="px-3 py-2 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Status</span>
                          <span className="font-medium text-blue-700 capitalize">{result.status.replace(/_/g, " ")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Acuity</span>
                          <span className={`font-bold uppercase px-1.5 py-0.5 rounded text-xs ${
                            result.acuity === "critical" ? "bg-red-100 text-red-700" :
                            result.acuity === "high"     ? "bg-orange-100 text-orange-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{result.acuity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Orders</span>
                          <span className="font-medium">{result.orders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Safety Flags</span>
                          <span className={`font-bold ${result.safetyFlags > 0 ? "text-red-600" : "text-gray-700"}`}>{result.safetyFlags}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Audit Entries</span>
                          <span className="font-medium">{result.auditEntries}</span>
                        </div>
                        {result.confidence && (
                          <div>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-gray-400">Dx Confidence</span>
                              <span className="font-medium">{(result.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-1 bg-gray-200 rounded-full">
                              <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${result.confidence * 100}%` }} />
                            </div>
                          </div>
                        )}
                        {result.diagnosis && (
                          <div>
                            <p className="text-gray-400">Diagnosis</p>
                            <p className="font-medium text-gray-800">{result.diagnosis}</p>
                          </div>
                        )}
                      </div>
                    ) : loading ? (
                      <div className="px-3 py-6 text-center text-xs text-gray-400">
                        <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-blue-500" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Running agents...
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-gray-400 italic">
                        Click Launch to run pipeline
                      </div>
                    )}
                  </div>

                  {result && (
                    <div className="bg-white border border-gray-200 rounded">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Continue To</span>
                      </div>
                      <div className="px-3 py-2 space-y-2">
                        <a href={NURSE_URL} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors">
                          Nurse Station
                        </a>
                        <a href={DOCTOR_URL} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold bg-[#2563a8] text-white rounded hover:bg-[#1e3f7a] transition-colors">
                          Doctor CRM
                        </a>
                        <a href="https://healthflow-paramedic.vercel.app" target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors">
                          Paramedic View
                        </a>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white border border-gray-200 rounded flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 font-medium">Select a patient scenario</p>
                <p className="text-gray-300 text-xs mt-1">Choose from the preset emergency cases on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
