"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Encounter } from "@/types";
import { getEncounters, addNursingNote, setTriageStatus, subscribeToEncounters } from "@/lib/api";

const TRIAGE_OPTS = ["pending","in_assessment","ready_for_doctor","escalated"] as const;
const NOTE_CATS = ["assessment","vitals_update","medication","escalation","general"] as const;

function Panel({ title, badge, children, className="" }: { title:string; badge?:React.ReactNode; children:React.ReactNode; className?:string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#00a99d] font-bold text-xs tracking-widest uppercase">{title}</span>
          {badge}
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
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

export default function NurseStation() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter|null>(null);
  const [note, setNote] = useState("");
  const [cat, setCat] = useState<string>("assessment");
  const [saving, setSaving] = useState(false);
  const [triaging, setTriaging] = useState(false);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);

  // Mirror current list + a pending shared-selection id so a `select` broadcast
  // that arrives before its `upsert` still focuses the patient once it lands.
  const encountersRef = useRef<Encounter[]>([]);
  useEffect(() => { encountersRef.current = encounters; }, [encounters]);
  const pendingSelectRef = useRef<string | null>(null);

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
        // A shared-selection broadcast may have arrived before this encounter existed.
        if (pendingSelectRef.current === enc.id) { setSelected(enc); pendingSelectRef.current = null; }
      },
      onDelete: (id) => {
        setEncounters(prev => prev.filter(e=>e.id!==id));
        if (selectedIdRef.current === id) setSelected(null);
      },
      // 911 (or any station) focused a patient — jump every tab to it at once.
      onSelect: (id) => {
        pendingSelectRef.current = id;
        if (!id) return;
        const found = encountersRef.current.find(e=>e.id===id);
        if (found) { setSelected(found); pendingSelectRef.current = null; }
      },
    });
    // 3s polling keeps the nurse view fresh from Supabase HealthFlow_transcript.
    const poll = setInterval(refresh, 3000);
    return () => { dispose(); clearInterval(poll); };
  }, [refresh]);

  const handleNote = async () => {
    if (!note.trim() || !selected) return;
    setSaving(true);
    try { const u = await addNursingNote(selected.id, note.trim(), cat); setSelected(u); setNote(""); } finally { setSaving(false); }
  };

  const handleTriage = async (status: string) => {
    if (!selected) return;
    setTriaging(true);
    try { const u = await setTriageStatus(selected.id, status); setSelected(u); } finally { setTriaging(false); }
  };

  const critical = encounters.filter(e=>e.acuity==="critical").length;
  const pending = encounters.filter(e=>!e.triageStatus||e.triageStatus==="pending").length;
  const forDoctor = encounters.filter(e=>e.status==="needs_doctor_approval"||e.triageStatus==="escalated").length;

  const riskColor = (acuity: string) =>
    acuity==="critical"?"bg-red-500":acuity==="high"?"bg-orange-500":acuity==="medium"?"bg-yellow-500":"bg-green-500";

  const DOCTOR_URL = process.env.NEXT_PUBLIC_DOCTOR_CRM_URL ?? "https://guestflow-doctor.vercel.app";
  const v = selected?.structuredData?.vitals ?? {};
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
        {["Add Note","Set Triage","Escalate","Print","Refresh"].map(a=>(
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
            <div className="divide-y divide-gray-50">
              {encounters.length === 0 && <p className="text-xs text-gray-400 italic text-center py-6">No encounters yet</p>}
              {encounters.map(e=>(
                <button key={e.id} onClick={()=>setSelected(e)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors ${selected?.id===e.id?"bg-blue-50 border-l-2 border-l-teal-500":e.acuity==="critical"?"border-l-2 border-l-red-400":""}`}>
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
                    <span className="text-xs text-gray-400 ml-auto">{new Date(e.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* CENTER: Assessment */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {selected ? (
            <>
              {/* Vitals Row */}
              <Panel title="Vital Signs">
                <div className="px-3 py-2">
                  <div className="grid grid-cols-6 gap-2">
                    {([["Heart Rate",v.heartRate,"bpm"],["Blood Pressure",v.bloodPressure,"mmHg"],["SpO₂",v.spO2,"%"],["Temp",v.temperature,"°F"],["Resp Rate",v.respiratoryRate,"/min"],["GCS",v.gcs,"/15"]] as const).map(([l,val,u])=>(
                      <div key={String(l)} className={`border rounded p-2 text-center ${val?"border-gray-200":"border-dashed border-gray-200 opacity-50"}`}>
                        <p className="text-xs text-gray-400">{l}</p>
                        <p className="text-base font-bold text-gray-900">{val ?? "—"}</p>
                        {val && <p className="text-xs text-gray-400">{u}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              {/* AI Nurse Assessment — Main Feature */}
              {na ? (
                <Panel title="AI Nurse Assessment" badge={<ESIBadge level={na.acuity_level} />} className="flex-1">
                  <div className="px-3 py-2 overflow-auto h-full space-y-3 text-xs">
                    {/* Override / Isolation Alerts */}
                    {(na.override_flag || na.isolation_required) && (
                      <div className="flex gap-2">
                        {na.override_flag && (
                          <div className="flex-1 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-2">
                            <span className="text-red-700 font-bold">OVERRIDE FLAG - Manual physician review required</span>
                          </div>
                        )}
                        {na.isolation_required && (
                          <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-2">
                            <span className="text-yellow-700 font-bold">ISOLATION REQUIRED</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Intake Notes */}
                    <div className="bg-teal-50 border border-teal-200 rounded p-2.5">
                      <p className="text-teal-700 font-bold uppercase text-xs mb-1">Intake Notes</p>
                      <p className="text-gray-800 leading-relaxed">{na.intake_notes}</p>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="border rounded p-2 text-center">
                        <p className="text-gray-400">Priority</p>
                        <p className={`text-xl font-bold ${na.priority_rank <= 2 ? "text-red-600" : na.priority_rank === 3 ? "text-orange-600" : "text-green-600"}`}>#{na.priority_rank}</p>
                      </div>
                      <div className="border rounded p-2 text-center">
                        <p className="text-gray-400">Triage</p>
                        <p className="text-sm font-bold text-gray-900">{na.triage_category}</p>
                      </div>
                      <div className="border rounded p-2 text-center">
                        <p className="text-gray-400">Arrival</p>
                        <p className="text-sm font-bold text-gray-900 capitalize">{na.patient_arrival_status}</p>
                      </div>
                      <div className="border rounded p-2 text-center">
                        <p className="text-gray-400">Est. Wait</p>
                        <p className="text-sm font-bold text-blue-700">{na.estimated_wait_time}</p>
                      </div>
                    </div>

                    {/* Room + Equipment Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 font-medium uppercase mb-1">Room / Bed Assignment</p>
                        <div className="bg-blue-50 border border-blue-200 rounded p-2">
                          <p className="font-bold text-blue-800">{na.room_assignment}</p>
                          <p className="text-blue-600">{na.bed_assignment}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium uppercase mb-1">Equipment Requested ({na.equipment_requested.length})</p>
                        <div className="bg-gray-50 border rounded p-2 space-y-0.5 max-h-20 overflow-auto">
                          {na.equipment_requested.map((eq,i)=>(
                            <div key={i} className="flex items-center gap-1 text-gray-700">
                              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full flex-shrink-0"/>
                              {eq}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Follow-up Tests + Specialist */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 font-medium uppercase mb-1">Follow-Up Tests ({na.follow_up_tests.length})</p>
                        <div className="bg-gray-50 border rounded p-2 space-y-0.5 max-h-20 overflow-auto">
                          {na.follow_up_tests.map((t,i)=>(
                            <div key={i} className="flex items-center gap-1 text-gray-700">
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"/>
                              {t}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-gray-400 font-medium uppercase mb-1">Specialist Consult</p>
                          <div className={`border rounded p-2 ${na.specialist_consult_needed ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
                            <p className={`font-medium ${na.specialist_consult_needed ? "text-orange-700" : "text-green-700"}`}>
                              {na.specialist_consult_needed ?? "None required"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium uppercase mb-1">Family Notifications</p>
                          <p className="text-gray-700 bg-gray-50 border rounded p-2">{na.family_notifications}</p>
                        </div>
                      </div>
                    </div>

                    {/* Nurse Observations */}
                    <div>
                      <p className="text-gray-400 font-medium uppercase mb-1">Nurse Observations</p>
                      <p className="text-gray-800 bg-gray-50 border rounded p-2 leading-relaxed">{na.nurse_observations}</p>
                    </div>

                    {/* Handoff to Doctor */}
                    <div className="bg-blue-50 border-2 border-blue-300 rounded p-2.5">
                      <p className="text-blue-800 font-bold uppercase text-xs mb-1">Handoff to Doctor (SBAR)</p>
                      <p className="text-blue-900 leading-relaxed">{na.handoff_to_doctor}</p>
                    </div>
                  </div>
                </Panel>
              ) : (
                <div className="flex-1 flex gap-3">
                  <Panel title="AI Clinical Assessment" className="flex-1">
                    <div className="px-3 py-2 space-y-3 text-xs overflow-auto h-full">
                      {selected.diagnosis ? (
                        <>
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
                          {(selected.safetyFlags?.length??0)>0 && (
                            <div className="border-t border-gray-100 pt-2">
                              <p className="font-bold text-red-600 uppercase mb-1">Safety Flags</p>
                              {selected.safetyFlags!.map((f,i)=>(
                                <div key={i} className="bg-red-50 border border-red-100 rounded p-2 mb-1">
                                  <p className="font-bold text-red-700">{f.severity.toUpperCase()}: {f.drug}</p>
                                  <p className="text-red-600">{f.description}</p>
                                  {f.alternative && <p className="text-emerald-700 font-medium">Alt: {f.alternative}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-teal-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            <p className="text-gray-400">AI assessment generating...</p>
                            <p className="text-gray-300 text-xs mt-1">Nurse triage data will appear here in real-time</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Panel>
                  <Panel title="Patient History" className="w-44 flex-shrink-0">
                    <div className="px-3 py-2 space-y-3 text-xs">
                      <div><p className="text-gray-400 mb-1">Allergies</p>
                        {selected.patientContext?.allergies.length ? selected.patientContext.allergies.map(a=>(
                          <div key={a} className="flex items-center gap-1 text-red-700 mb-0.5"><span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0"/>{a}</div>
                        )) : <p className="text-gray-400 italic">None known</p>}
                      </div>
                      <div><p className="text-gray-400 mb-1">Current Medications</p>
                        {selected.patientContext?.currentMedications.map(m=>(
                          <div key={m} className="flex items-center gap-1 text-gray-700 mb-0.5"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"/>{m}</div>
                        )) ?? <p className="text-gray-400 italic">None</p>}
                      </div>
                      <div><p className="text-gray-400 mb-1">Conditions</p>
                        {selected.patientContext?.conditions.map(c=>(
                          <div key={c} className="flex items-center gap-1 text-gray-700 mb-0.5"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"/>{c}</div>
                        )) ?? <p className="text-gray-400 italic">None</p>}
                      </div>
                    </div>
                  </Panel>
                </div>
              )}

              {/* AI Nurse Care Plan — the ordered nursing steps to treat this patient */}
              {selected.nursingCarePlan ? (
                <Panel
                  title="Nursing Care Plan — Steps to Treat"
                  badge={<span className="text-xs font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 uppercase">{selected.nursingCarePlan.engine === "ai" ? "AI" : "Protocol"}</span>}
                  className="flex-1"
                >
                  <div className="px-3 py-2 overflow-auto h-full space-y-2 text-xs">
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
                <Panel title="Nursing Care Plan — Steps to Treat" className="flex-shrink-0">
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

        {/* RIGHT: Nursing Notes + Handoff */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3">
          <Panel title={`Nursing Notes (${selected?.nursingNotes?.length??0})`} className="flex-1">
            {selected ? (
              <>
                <div className="flex-1 overflow-auto px-3 py-2 space-y-2 min-h-0">
                  {(selected.nursingNotes?.length??0)===0 && <p className="text-xs text-gray-400 italic text-center py-4">No notes yet</p>}
                  {selected.nursingNotes?.map(n=>(
                    <div key={n.id} className="border border-teal-100 bg-teal-50 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded capitalize font-medium">{n.category.replace(/_/g," ")}</span>
                        <span className="text-xs text-gray-400">{new Date(n.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <p className="text-xs text-gray-800">{n.note}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.nurseName}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 px-3 py-2 flex-shrink-0">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {NOTE_CATS.map(c=>(
                      <button key={c} onClick={()=>setCat(c)}
                        className={`text-xs px-2 py-0.5 rounded-full capitalize border transition-colors ${cat===c?"bg-teal-600 text-white border-teal-600":"border-gray-300 text-gray-500 hover:border-teal-400"}`}>
                        {c.replace(/_/g," ")}
                      </button>
                    ))}
                  </div>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add nursing note..." rows={3}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 mb-1.5"/>
                  <button onClick={handleNote} disabled={!note.trim()||saving}
                    className="w-full py-1.5 bg-teal-600 text-white text-xs font-semibold rounded hover:bg-teal-700 disabled:opacity-50 transition-colors">
                    {saving?"Saving...":"Add Note"}
                  </button>
                </div>
              </>
            ) : <p className="text-xs text-gray-400 italic text-center py-6">Select a patient</p>}
          </Panel>

          <Panel title="Handoff" className="flex-shrink-0">
            <div className="px-3 py-2">
              <a href={DOCTOR_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-[#2563a8] text-white rounded text-xs font-semibold hover:bg-[#1e3f7a] transition-colors">
                <span>Send to Doctor CRM</span><span className="ml-auto">&rsaquo;</span>
              </a>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
