"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Encounter } from "@/types";
import { getEncounters, addNursingNote, setTriageStatus, subscribeToEncounters } from "@/lib/api";

const TRIAGE_OPTS = ["pending","in_assessment","ready_for_doctor","escalated"] as const;
const NOTE_CATS = ["assessment","vitals_update","medication","escalation","general"] as const;

function Panel({ title, children, className="" }: { title:string; children:React.ReactNode; className?:string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <span className="text-[#00a99d] font-bold text-xs tracking-widest uppercase">{title}</span>
        <button className="text-[#2563a8] text-base font-bold leading-none">+</button>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
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
    // SSE handles real-time. A 30s poll is a safety net in case the stream
    // dies and the browser fails to reconnect (e.g., behind certain proxies).
    refresh();
    const dispose = subscribeToEncounters({
      onSnapshot: (list) => {
        setEncounters(list);
        if (selectedIdRef.current) {
          const u = list.find(e=>e.id===selectedIdRef.current);
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
      },
      onDelete: (id) => {
        setEncounters(prev => prev.filter(e=>e.id!==id));
        if (selectedIdRef.current === id) setSelected(null);
      },
    });
    const poll = setInterval(refresh, 30000);
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

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:"13px"}}>
      {/* Top Nav */}
      <nav className="bg-[#1e3f7a] text-white flex items-center h-10 px-3 gap-3 flex-shrink-0">
        <div className="grid grid-cols-3 gap-0.5 w-5 h-5 flex-shrink-0">
          {Array.from({length:9}).map((_,i)=><div key={i} className="w-1.5 h-1.5 bg-white rounded-sm opacity-80"/>)}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="opacity-60">HealthFlow</span><span className="opacity-30 mx-1">›</span>
          <span className="opacity-60">Nursing</span><span className="opacity-30 mx-1">›</span>
          <span className="font-semibold">Maria Rodriguez, RN — Bay 3</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm opacity-70">
          <span>🔍</span><span>⚙</span>
          <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold">MR</div>
        </div>
      </nav>

      {/* Action bar */}
      <div className="bg-[#2563a8] text-white flex items-center h-9 px-3 gap-1 flex-shrink-0">
        {["📋 ADD NOTE","🏥 SET TRIAGE","🚨 ESCALATE","🖨 PRINT","🔄 REFRESH"].map(a=>(
          <button key={a} className="text-xs font-medium px-3 h-7 rounded border border-white/20 hover:bg-white/10 transition-colors">{a}</button>
        ))}
        <div className="ml-auto flex gap-4 text-xs">
          {[["Total",encounters.length,"text-white"],["Critical",critical,"text-red-300"],["Pending",pending,"text-yellow-200"],["For Doctor",forDoctor,"text-orange-300"]].map(([l,v,c])=>(
            <span key={String(l)} className="flex items-center gap-1"><strong className={String(c)}>{String(v)}</strong><span className="opacity-60">{String(l)}</span></span>
          ))}
        </div>
      </div>

      {/* Patient header */}
      {selected && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {selected.patientContext?.name.split(" ").map(n=>n[0]).join("") ?? "?"}
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">PATIENT</p>
            <p className="text-lg font-bold text-gray-900">{selected.patientContext?.name ?? "Unknown"}</p>
            <p className="text-xs text-gray-500">{selected.structuredData?.chiefComplaint} · via {selected.paramedicName}</p>
          </div>
          <div className="flex gap-5 text-xs">
            <div><p className="text-gray-400">Age / Sex</p><p className="font-semibold">{selected.patientContext?.age}yo {selected.patientContext?.sex}</p></div>
            <div><p className="text-gray-400">Preferred Contact</p><p className="font-semibold">Secure Message</p></div>
            <div><p className="text-gray-400">Language</p><p className="font-semibold">English</p></div>
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
                      <p className="text-gray-500 text-xs truncate">{e.structuredData?.chiefComplaint ?? "Processing…"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-xs px-1.5 rounded font-medium text-white ${riskColor(e.acuity)}`}>{e.acuity}</span>
                    {(e.safetyFlags?.length??0)>0 && <span className="text-xs text-red-600 font-bold">⚠{e.safetyFlags!.length}</span>}
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
              <Panel title="Vital Signs">
                <div className="px-3 py-2">
                  <div className="grid grid-cols-6 gap-2">
                    {[["Heart Rate",v.heartRate,"bpm","8867-4"],["Blood Pressure",v.bloodPressure,"mmHg","85354-9"],["SpO₂",v.spO2,"%","2708-6"],["Temp",v.temperature,"°F","8310-5"],["Resp Rate",v.respiratoryRate,"/min","9279-1"],["GCS",v.gcs,"/15","9269-2"]].map(([l,val,u])=>(
                      <div key={String(l)} className={`border rounded p-2 text-center ${val?"border-gray-200":"border-dashed border-gray-200 opacity-50"}`}>
                        <p className="text-xs text-gray-400">{l}</p>
                        <p className="text-base font-bold text-gray-900">{val ?? "—"}</p>
                        {val && <p className="text-xs text-gray-400">{u}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <div className="flex gap-3 flex-1 min-h-0">
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
                        <div>
                          <p className="text-gray-400 mb-1">Differentials</p>
                          <table className="w-full"><tbody>
                            {selected.diagnosis.differentials.map((d,i)=>(
                              <tr key={i} className="border-b border-gray-50 last:border-0">
                                <td className="py-1 text-gray-700">{d.condition}</td>
                                <td className="py-1 text-right text-gray-500">{(d.probability*100).toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody></table>
                        </div>
                        {(selected.safetyFlags?.length??0)>0 && (
                          <div className="border-t border-gray-100 pt-2">
                            <p className="font-bold text-red-600 uppercase mb-1">⚠ Safety Flags</p>
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
                    ) : <p className="text-gray-400 italic">No diagnosis available</p>}
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
            </>
          ) : (
            <div className="flex-1 bg-white border border-gray-200 rounded flex items-center justify-center">
              <div className="text-center"><div className="text-4xl mb-3">🏥</div><p className="text-gray-400 font-medium">Select a patient from the queue</p></div>
            </div>
          )}
        </div>

        {/* RIGHT: Nursing Notes */}
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
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add nursing note…" rows={3}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 mb-1.5"/>
                  <button onClick={handleNote} disabled={!note.trim()||saving}
                    className="w-full py-1.5 bg-teal-600 text-white text-xs font-semibold rounded hover:bg-teal-700 disabled:opacity-50 transition-colors">
                    {saving?"Saving…":"Add Note"}
                  </button>
                </div>
              </>
            ) : <p className="text-xs text-gray-400 italic text-center py-6">Select a patient</p>}
          </Panel>

          <Panel title="Appointments" className="flex-shrink-0">
            <div className="px-3 py-1 text-xs">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left py-1 text-gray-400 font-medium">Time</th>
                  <th className="text-left py-1 text-gray-400 font-medium">Type</th>
                  <th className="text-right py-1 text-gray-400 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {selected ? [
                    [new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),"ED Triage","IN PROGRESS"],
                    ["Pending","Physician Review","SCHEDULED"],
                  ].map(([t,type,s])=>(
                    <tr key={String(t)} className="border-b border-gray-50">
                      <td className="py-1 text-gray-600">{t}</td>
                      <td className="py-1 text-gray-700">{type}</td>
                      <td className="py-1 text-right"><span className={`text-xs font-bold ${s==="IN PROGRESS"?"text-green-600":s==="SCHEDULED"?"text-blue-600":"text-gray-500"}`}>{s}</span></td>
                    </tr>
                  )) : <tr><td colSpan={3} className="py-3 text-center text-gray-400 italic">No patient selected</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Handoff" className="flex-shrink-0">
            <div className="px-3 py-2">
              <a href={DOCTOR_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-[#2563a8] text-white rounded text-xs font-semibold hover:bg-[#1e3f7a] transition-colors">
                <span>👨‍⚕️</span><span>Send to Doctor CRM</span><span className="ml-auto">›</span>
              </a>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
