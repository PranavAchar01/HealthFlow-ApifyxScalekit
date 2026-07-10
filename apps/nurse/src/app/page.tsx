"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Encounter } from "@/types";
import {
  getEncounters, addNursingNote, setTriageStatus,
  updateVitals, interpretVitals, subscribeToEncounters,
  type VitalsInterpretation,
} from "@/lib/api";

const TRIAGE_OPTS = ["pending","in_assessment","ready_for_doctor","escalated"] as const;

function Panel({ title, badge, collapsible, defaultOpen=true, children, className="" }: {
  title: string; badge?: React.ReactNode; collapsible?: boolean;
  defaultOpen?: boolean; children: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white border border-gray-200 rounded flex flex-col ${className}`}>
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0 ${collapsible ? "cursor-pointer hover:bg-gray-50 select-none" : ""}`}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-[#00a99d] font-bold text-xs tracking-widest uppercase">{title}</span>
          {badge}
        </div>
        {collapsible && <span className="text-gray-400 text-xs">{open ? "▾" : "▸"}</span>}
      </div>
      {(!collapsible || open) && <div className="flex-1 overflow-auto">{children}</div>}
    </div>
  );
}

function ESIBadge({ level }: { level: string }) {
  const colors: Record<string,string> = {
    "ESI-1": "bg-red-600 text-white",
    "ESI-2": "bg-orange-500 text-white",
    "ESI-3": "bg-yellow-500 text-white",
    "ESI-4": "bg-blue-500 text-white",
    "ESI-5": "bg-green-500 text-white",
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors[level] ?? "bg-gray-200 text-gray-700"}`}>{level}</span>;
}

const VITALS_FIELDS = [
  { label: "Heart Rate",     key: "heartRate"       as const, unit: "bpm"  },
  { label: "Blood Pressure", key: "bloodPressure"   as const, unit: "mmHg" },
  { label: "SpO₂",           key: "spO2"            as const, unit: "%"    },
  { label: "Temp",           key: "temperature"     as const, unit: "°F"   },
  { label: "Resp Rate",      key: "respiratoryRate" as const, unit: "/min" },
  { label: "GCS",            key: "gcs"             as const, unit: "/15"  },
] as const;

type VitalsForm = { [K in typeof VITALS_FIELDS[number]["key"]]: string };

import type { Vitals } from "@/types";

function emptyVitals(v: Vitals = {}): VitalsForm {
  return {
    heartRate:       String(v.heartRate       ?? ""),
    bloodPressure:   String(v.bloodPressure   ?? ""),
    spO2:            String(v.spO2            ?? ""),
    temperature:     String(v.temperature     ?? ""),
    respiratoryRate: String(v.respiratoryRate ?? ""),
    gcs:             String(v.gcs             ?? ""),
  };
}

function EncounterRow({ e, selected, onSelect, riskColor }: {
  e: Encounter; selected: Encounter | null;
  onSelect: (enc: Encounter) => void;
  riskColor: (acuity: string) => string;
}) {
  return (
    <button onClick={() => onSelect(e)}
      className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors ${selected?.id===e.id?"bg-blue-50 border-l-2 border-l-teal-500":e.acuity==="critical"?"border-l-2 border-l-red-400":"border-l-2 border-l-transparent"}`}>
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${riskColor(e.acuity)}`}>
          {e.patientContext?.name?.split(" ").map(n=>n[0]).join("") ?? "?"}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-xs truncate">{e.patientContext?.name ?? "Unknown"}</p>
          <p className="text-gray-500 text-xs truncate">{e.structuredData?.chiefComplaint ?? "Processing..."}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span className={`text-xs px-1.5 rounded font-medium text-white ${riskColor(e.acuity)}`}>{e.acuity}</span>
        {e.nurseAssessment && <span className="text-xs text-teal-600 font-medium">{e.nurseAssessment.acuity_level}</span>}
        {(e.safetyFlags?.length??0)>0 && <span className="text-xs text-red-600 font-bold">!{e.safetyFlags!.length}</span>}
        <span className="text-xs text-gray-400 ml-auto" suppressHydrationWarning>{new Date(e.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
      </div>
    </button>
  );
}

export default function NurseStation() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter|null>(null);
  const [triaging, setTriaging] = useState(false);

  // Vitals editing
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>(emptyVitals());
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [vitalsAnalysis, setVitalsAnalysis] = useState<VitalsInterpretation | null>(null);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);

  const encountersRef = useRef<Encounter[]>([]);
  useEffect(() => { encountersRef.current = encounters; }, [encounters]);
  const pendingSelectRef = useRef<string | null>(null);

  // Reset vitals form whenever a different patient is selected
  useEffect(() => {
    setVitalsForm(emptyVitals(selected?.structuredData?.vitals ?? {}));
    setVitalsAnalysis(null);
  }, [selected?.id]);

  const refresh = useCallback(async () => {
    try {
      const list = await getEncounters();
      setEncounters(list);
      if (selectedIdRef.current) {
        const u = list.find(e=>e.id===selectedIdRef.current);
        if (u) setSelected(u);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const dispose = subscribeToEncounters({
      onSnapshot: (list, selectedId) => {
        setEncounters(list);
        const focus = selectedId ?? selectedIdRef.current;
        if (focus) {
          const u = list.find(e=>e.id===focus);
          if (u) setSelected(u);
        }
      },
      onUpsert: (enc) => {
        setEncounters(prev => {
          const idx = prev.findIndex(e=>e.id===enc.id);
          if (idx === -1) return [enc, ...prev];
          const next = [...prev]; next[idx] = enc; return next;
        });
        if (selectedIdRef.current === enc.id) setSelected(enc);
        if (pendingSelectRef.current === enc.id) { setSelected(enc); pendingSelectRef.current = null; }
      },
      onDelete: (id) => {
        setEncounters(prev => prev.filter(e=>e.id!==id));
        if (selectedIdRef.current === id) setSelected(null);
      },
      onSelect: (id) => {
        pendingSelectRef.current = id;
        if (!id) return;
        const found = encountersRef.current.find(e=>e.id===id);
        if (found) { setSelected(found); pendingSelectRef.current = null; }
      },
    });
    const poll = setInterval(refresh, 3000);
    return () => { dispose(); clearInterval(poll); };
  }, [refresh]);

  const handleTriage = async (status: string) => {
    if (!selected) return;
    setTriaging(true);
    try { const u = await setTriageStatus(selected.id, status); setSelected(u); } finally { setTriaging(false); }
  };

  const handleSaveVitals = async () => {
    if (!selected) return;
    setIsSavingVitals(true);
    setVitalsAnalysis(null);
    try {
      const payload: Record<string, string | number> = {};
      Object.entries(vitalsForm).forEach(([k, val]) => {
        const s = String(val).trim();
        if (s) payload[k] = isNaN(Number(s)) ? s : Number(s);
      });
      const updated = await updateVitals(selected.id, payload);
      setSelected(updated);
      setIsInterpreting(true);
      try {
        const analysis = await interpretVitals(selected.id);
        setVitalsAnalysis(analysis);
      } catch { /* non-critical */ }
      finally { setIsInterpreting(false); }
    } finally {
      setIsSavingVitals(false);
    }
  };

  const handleFinishAndSend = async () => {
    await handleSaveVitals();
    await handleTriage("ready_for_doctor");
  };

  const [queueOpen, setQueueOpen] = useState(false);

  const critical = encounters.filter(e=>e.acuity==="critical").length;
  const pending = encounters.filter(e=>!e.triageStatus||e.triageStatus==="pending").length;
  const forDoctor = encounters.filter(e=>e.status==="needs_doctor_approval"||e.triageStatus==="escalated").length;
  const activeEncounters = encounters.filter(e=>e.status==="needs_doctor_approval"||e.triageStatus==="escalated"||e.triageStatus==="ready_for_doctor");
  const queuedEncounters = encounters.filter(e=>e.status!=="needs_doctor_approval"&&e.triageStatus!=="escalated"&&e.triageStatus!=="ready_for_doctor");
  const riskColor = (acuity: string) =>
    acuity==="critical"?"bg-red-500":acuity==="high"?"bg-orange-500":acuity==="medium"?"bg-yellow-500":"bg-green-500";

  const DOCTOR_URL = process.env.NEXT_PUBLIC_DOCTOR_CRM_URL ?? "http://localhost:3003";
  const na = selected?.nurseAssessment;

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:"13px"}}>
      {/* Top Nav */}
      <nav className="bg-[#1e3f7a] text-white flex items-center h-10 px-3 gap-3 flex-shrink-0">
        <div className="grid grid-cols-3 gap-0.5 w-5 h-5 flex-shrink-0">
          {Array.from({length:9}).map((_,i)=><div key={i} className="w-1.5 h-1.5 bg-white rounded-sm opacity-80"/>)}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="opacity-60">HealthFlow</span><span className="opacity-30 mx-1">&rsaquo;</span>
          <span className="opacity-60">Nursing</span><span className="opacity-30 mx-1">&rsaquo;</span>
          <span className="font-semibold">Maria Rodriguez, RN - Bay 3</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm opacity-70">
          <span>Search</span><span>Settings</span>
          <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold">MR</div>
        </div>
      </nav>

      {/* Action bar */}
      <div className="bg-[#2563a8] text-white flex items-center h-9 px-3 gap-1 flex-shrink-0">
        {["Set Triage","Escalate","Print","Refresh"].map(a=>(
          <button key={a} className="text-xs font-medium px-3 h-7 rounded border border-white/20 hover:bg-white/10 transition-colors">{a}</button>
        ))}
        <div className="ml-auto flex gap-4 text-xs">
          {[["Total",encounters.length,"text-white"],["Critical",critical,"text-red-300"],["Pending",pending,"text-yellow-200"],["For Doctor",forDoctor,"text-orange-300"]].map(([l,val,c])=>(
            <span key={String(l)} className="flex items-center gap-1"><strong className={String(c)}>{String(val)}</strong><span className="opacity-60">{String(l)}</span></span>
          ))}
        </div>
      </div>

      {/* Patient header */}
      {selected && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {selected.patientContext?.name?.split(" ").map(n=>n[0]).join("") ?? "?"}
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">PATIENT</p>
            <p className="text-lg font-bold text-gray-900">{selected.patientContext?.name ?? "Unknown"}</p>
            <p className="text-xs text-gray-500">{selected.structuredData?.chiefComplaint} &middot; via {selected.paramedicName}</p>
          </div>
          <div className="flex gap-5 text-xs">
            <div><p className="text-gray-400">Age / Sex</p><p className="font-semibold">{selected.patientContext?.age}yo {selected.patientContext?.sex}</p></div>
            {na && (
              <>
                <div><p className="text-gray-400">Room</p><p className="font-semibold text-blue-700">{na.room_assignment}</p></div>
                <div><p className="text-gray-400">Bed</p><p className="font-semibold">{na.bed_assignment}</p></div>
                <div><p className="text-gray-400">ESI Level</p><ESIBadge level={na.acuity_level} /></div>
                <div><p className="text-gray-400">Wait Time</p><p className="font-semibold">{na.estimated_wait_time}</p></div>
              </>
            )}
            <div><p className="text-gray-400">Triage Status</p>
              <select value={selected.triageStatus ?? "pending"} onChange={e=>handleTriage(e.target.value)} disabled={triaging}
                className="text-xs font-semibold border-0 bg-transparent cursor-pointer focus:outline-none text-blue-700">
                {TRIAGE_OPTS.map(o=><option key={o} value={o}>{o.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div><p className="text-gray-400">Risk Level</p>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${riskColor(selected.acuity)}`}>
                {selected.acuity.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* LEFT: Queue */}
        <div className="w-52 flex-shrink-0">
          <Panel title={`Triage Queue (${encounters.length})`} className="h-full">
            <div className="overflow-y-auto h-full">
              {encounters.length === 0 && <p className="text-xs text-gray-400 italic text-center py-6">No encounters yet</p>}

              {/* Active patients — always visible */}
              {activeEncounters.length > 0 && (
                <div className="border-b border-gray-100">
                  <p className="text-xs font-bold text-red-600 px-3 py-1.5 bg-red-50">ACTIVE ({activeEncounters.length})</p>
                  {activeEncounters.map(e => (
                    <EncounterRow key={e.id} e={e} selected={selected} onSelect={setSelected} riskColor={riskColor} />
                  ))}
                </div>
              )}

              {/* Rest — collapsible, folded by default */}
              {queuedEncounters.length > 0 && (
                <div>
                  <button
                    onClick={() => setQueueOpen(o => !o)}
                    className="w-full flex items-center justify-between text-xs font-bold text-gray-400 px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <span>QUEUE ({queuedEncounters.length})</span>
                    <span>{queueOpen ? "▾" : "▸"}</span>
                  </button>
                  {queueOpen && queuedEncounters.map(e => (
                    <EncounterRow key={e.id} e={e} selected={selected} onSelect={setSelected} riskColor={riskColor} />
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* CENTER: Assessment */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
          {selected ? (
            <>
              {/* Vitals — Editable */}
              <Panel title="Vital Signs" className="flex-shrink-0">
                <div className="px-3 py-2">
                  <div className="grid grid-cols-3 gap-2">
                    {VITALS_FIELDS.map(({ label, key, unit }) => (
                      <div key={key} className="bg-white rounded-lg border p-2.5">
                        <p className="text-xs text-gray-500 mb-1">{label} <span className="text-gray-300">{unit}</span></p>
                        <input
                          value={vitalsForm[key]}
                          onChange={e => setVitalsForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder="—"
                          className="w-full text-lg font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:border-teal-500 outline-none text-center pb-0.5"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveVitals}
                    disabled={isSavingVitals || isInterpreting}
                    className="mt-2 w-full py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {isSavingVitals ? "Saving…" : isInterpreting ? "Analysing…" : "Update Vitals"}
                  </button>

                  {/* AI Vitals Analysis */}
                  {vitalsAnalysis && (
                    <div className={`mt-3 rounded-lg border p-3 text-xs space-y-2 ${
                      vitalsAnalysis.critical
                        ? "bg-red-50 border-red-300"
                        : vitalsAnalysis.warnings.length > 0
                        ? "bg-amber-50 border-amber-300"
                        : "bg-emerald-50 border-emerald-300"
                    }`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {vitalsAnalysis.critical && (
                          <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded animate-pulse">
                            CRITICAL — IMMEDIATE ACTION REQUIRED
                          </span>
                        )}
                        <p className={`font-semibold ${vitalsAnalysis.critical ? "text-red-800" : vitalsAnalysis.warnings.length > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                          {vitalsAnalysis.summary}
                        </p>
                      </div>
                      {vitalsAnalysis.warnings.length > 0 && (
                        <div>
                          <p className="font-bold text-red-700 uppercase mb-1">⚠ Warnings</p>
                          {vitalsAnalysis.warnings.map((w, i) => (
                            <p key={i} className="text-red-700">• {w}</p>
                          ))}
                        </div>
                      )}
                      {vitalsAnalysis.recommendations.length > 0 && (
                        <div>
                          <p className="font-bold text-gray-600 uppercase mb-1">Recommendations</p>
                          {vitalsAnalysis.recommendations.map((r, i) => (
                            <p key={i} className="text-gray-700">• {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Panel>

              {/* AI Nurse Assessment — Collapsible */}
              {na ? (
                <Panel title="AI Nurse Assessment" badge={<ESIBadge level={na.acuity_level} />} collapsible defaultOpen={true} className="flex-shrink-0">
                  <div className="px-3 py-2 space-y-3 text-xs">
                    {(na.override_flag || na.isolation_required) && (
                      <div className="flex gap-2">
                        {na.override_flag && <div className="flex-1 bg-red-50 border border-red-200 rounded p-2 text-red-700 font-bold text-center">OVERRIDE FLAG - Manual physician review required</div>}
                        {na.isolation_required && <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-700 font-bold text-center">ISOLATION REQUIRED</div>}
                      </div>
                    )}

                    <div className="bg-teal-50 border border-teal-200 rounded p-2.5">
                      <p className="text-teal-700 font-bold uppercase text-xs mb-1">Intake Notes</p>
                      <p className="text-gray-800 leading-relaxed">{na.intake_notes}</p>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[
                        ["Priority", `#${na.priority_rank}`, na.priority_rank <= 2 ? "text-red-600" : na.priority_rank === 3 ? "text-orange-600" : "text-green-600"],
                        ["Triage", na.triage_category, "text-gray-900"],
                        ["Arrival", na.patient_arrival_status, "text-gray-900 capitalize"],
                        ["Est. Wait", na.estimated_wait_time, "text-blue-700"],
                      ].map(([label, val, cls]) => (
                        <div key={String(label)} className="border rounded p-1.5 text-center">
                          <p className="text-gray-400">{label}</p>
                          <p className={`text-sm font-bold ${cls}`}>{val}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 font-medium uppercase mb-1">Room / Bed</p>
                        <div className="bg-blue-50 border border-blue-200 rounded p-2">
                          <p className="font-bold text-blue-800">{na.room_assignment}</p>
                          <p className="text-blue-600">{na.bed_assignment}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium uppercase mb-1">Equipment ({na.equipment_requested.length})</p>
                        <div className="bg-gray-50 border rounded p-2 space-y-0.5 max-h-16 overflow-auto">
                          {na.equipment_requested.map((eq,i)=>(
                            <div key={i} className="flex items-center gap-1 text-gray-700"><span className="w-1.5 h-1.5 bg-teal-400 rounded-full flex-shrink-0"/>{eq}</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 font-medium uppercase mb-1">Follow-Up Tests</p>
                        <div className="flex flex-wrap gap-1">
                          {na.follow_up_tests.map((t,i)=>(
                            <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium uppercase mb-1">Specialist Consult</p>
                        <div className={`border rounded p-2 ${na.specialist_consult_needed ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
                          <p className={`font-medium ${na.specialist_consult_needed ? "text-orange-700" : "text-green-700"}`}>
                            {na.specialist_consult_needed ?? "None required"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 font-medium uppercase mb-1">Nurse Observations</p>
                      <p className="text-gray-800 bg-gray-50 border rounded p-2 leading-relaxed">{na.nurse_observations}</p>
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-300 rounded p-2.5">
                      <p className="text-blue-800 font-bold uppercase text-xs mb-1">Handoff to Doctor (SBAR)</p>
                      <p className="text-blue-900 leading-relaxed">{na.handoff_to_doctor}</p>
                    </div>
                  </div>
                </Panel>
              ) : selected.diagnosis ? (
                <Panel title="AI Clinical Assessment" collapsible defaultOpen={true} className="flex-shrink-0">
                  <div className="px-3 py-2 space-y-3 text-xs">
                    <div className="pb-2 border-b border-gray-100">
                      <p className="text-gray-400 mb-0.5">Primary Diagnosis</p>
                      <p className="font-bold text-blue-700 text-sm">{selected.diagnosis.primary}</p>
                      <p className="text-gray-400">ICD-10: {selected.diagnosis.icdCode}</p>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1"><span className="text-gray-400">Confidence</span><span className="font-medium">{(selected.diagnosis.confidence*100).toFixed(0)}%</span></div>
                      <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-blue-500 rounded-full" style={{width:`${selected.diagnosis.confidence*100}%`}}/></div>
                    </div>
                    <div><p className="text-gray-400 mb-1">Reasoning</p><p className="text-gray-700 leading-relaxed">{selected.diagnosis.reasoning}</p></div>
                  </div>
                </Panel>
              ) : null}

              {/* Nursing Care Plan — Collapsible */}
              {selected.nursingCarePlan ? (
                <Panel
                  title="Nursing Care Plan"
                  badge={<span className="text-xs font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 uppercase">{selected.nursingCarePlan.engine === "ai" ? "AI" : "Protocol"}</span>}
                  collapsible defaultOpen={false}
                  className="flex-shrink-0"
                >
                  <div className="px-3 py-2 space-y-2 text-xs">
                    <p className="text-gray-600 italic">{selected.nursingCarePlan.summary}</p>
                    {selected.nursingCarePlan.steps.map(s=>(
                      <div key={s.order} className="flex gap-2 border border-gray-100 rounded p-2 bg-white">
                        <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold flex-shrink-0">{s.order}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                              s.priority==="immediate" ? "bg-red-100 text-red-700" :
                              s.priority==="urgent" ? "bg-orange-100 text-orange-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{s.priority}</span>
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 capitalize">{s.category}</span>
                          </div>
                          <p className="font-semibold text-gray-900">{s.action}</p>
                          <p className="text-gray-500 mt-0.5">{s.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              ) : na ? (
                <Panel title="Nursing Care Plan" className="flex-shrink-0">
                  <div className="px-3 py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-teal-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    AI nurse is drafting treatment steps…
                  </div>
                </Panel>
              ) : null}
            </>
          ) : (
            <div className="flex-1 bg-white border border-gray-200 rounded flex items-center justify-center">
              <div className="text-center"><p className="text-gray-400 font-medium">Select a patient from the queue</p></div>
            </div>
          )}
        </div>

        {/* RIGHT: Patient info + handoff */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3">
          {/* Safety Flags */}
          {(selected?.safetyFlags?.length ?? 0) > 0 && (
            <Panel title="Safety Flags" collapsible defaultOpen={true} className="flex-shrink-0">
              <div className="px-3 py-2 space-y-2">
                {selected!.safetyFlags!.map((f,i)=>(
                  <div key={i} className="bg-red-50 border border-red-100 rounded p-2 text-xs">
                    <p className="font-bold text-red-700 uppercase">{f.severity}: {f.drug}</p>
                    <p className="text-red-600">vs {f.conflictsWith}</p>
                    <p className="text-red-500 mt-0.5">{f.description}</p>
                    {f.alternative && <p className="text-emerald-700 font-medium mt-0.5">Alt: {f.alternative}</p>}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Patient History" collapsible defaultOpen={true} className="flex-1">
            {selected ? (
              <div className="px-3 py-2 space-y-3 text-xs overflow-y-auto h-full">
                <div>
                  <p className="text-gray-400 mb-1">Allergies</p>
                  {selected.patientContext?.allergies.length ? selected.patientContext.allergies.map(a=>(
                    <div key={a} className="flex items-center gap-1 text-red-700 mb-0.5"><span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0"/>{a}</div>
                  )) : <p className="text-gray-400 italic">None known</p>}
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Current Medications</p>
                  {(selected.patientContext?.currentMedications ?? []).map(m=>(
                    <div key={m} className="flex items-center gap-1 text-gray-700 mb-0.5"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"/>{m}</div>
                  ))}
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Conditions</p>
                  {(selected.patientContext?.conditions ?? []).map(c=>(
                    <div key={c} className="flex items-center gap-1 text-gray-700 mb-0.5"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"/>{c}</div>
                  ))}
                </div>
              </div>
            ) : <p className="text-xs text-gray-400 italic text-center py-6">Select a patient</p>}
          </Panel>

          <Panel title="Handoff" className="flex-shrink-0">
            <div className="px-3 py-2 space-y-2">
              <button
                onClick={handleFinishAndSend}
                disabled={!selected || isSavingVitals || triaging}
                className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isSavingVitals || triaging ? "Finishing…" : "Finish & Send to Doctor"}
              </button>
              <a href={DOCTOR_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-[#2563a8] text-white rounded text-xs font-semibold hover:bg-[#1e3f7a] transition-colors">
                <span>Open Doctor CRM</span><span className="ml-auto">&rsaquo;</span>
              </a>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
