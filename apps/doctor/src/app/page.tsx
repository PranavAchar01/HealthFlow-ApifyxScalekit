"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Encounter } from "@/types";
import { getEncounters, commitEncounter, subscribeToEncounters } from "@/lib/api";

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

export default function DoctorCRM() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter|null>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string|null>(null);

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
    // 3s polling keeps the doctor view fresh from Supabase HealthFlow_transcript.
    const poll = setInterval(refresh, 3000);
    return () => { dispose(); clearInterval(poll); };
  }, [refresh]);

  const handleApprove = async () => {
    if (!selected) return;
    setApproving(true); setError(null);
    try { const d = await commitEncounter(selected.id); setSelected(d.encounter); await refresh(); }
    catch(err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setApproving(false); }
  };

  const pending = encounters.filter(e=>e.status==="needs_doctor_approval");
  const rest = encounters.filter(e=>e.status!=="needs_doctor_approval");
  const riskColor = (acuity: string) =>
    acuity==="critical"?"bg-red-500":acuity==="high"?"bg-orange-500":acuity==="medium"?"bg-yellow-500":"bg-green-500";

  const ORDER_TYPE_CLR: Record<string,string> = {
    medication:"bg-purple-100 text-purple-700",
    imaging:"bg-blue-100 text-blue-700",
    lab:"bg-cyan-100 text-cyan-700",
    procedure:"bg-amber-100 text-amber-700",
    consult:"bg-gray-100 text-gray-700",
  };
  const v = selected?.structuredData?.vitals ?? {};
  const isApproved = selected?.status === "committed" || selected?.status === "approved";

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:"13px"}}>
      {/* Top Nav */}
      <nav className="bg-[#1e3f7a] text-white flex items-center h-10 px-3 gap-3 flex-shrink-0">
        <div className="grid grid-cols-3 gap-0.5 w-5 h-5 flex-shrink-0">
          {Array.from({length:9}).map((_,i)=><div key={i} className="w-1.5 h-1.5 bg-white rounded-sm opacity-80"/>)}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="opacity-60">HealthFlow</span><span className="opacity-30 mx-1">›</span>
          <span className="opacity-60">Physician</span><span className="opacity-30 mx-1">›</span>
          <span className="font-semibold">{selected?.patientContext?.name ?? "Select Patient"}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm opacity-70">
          <span>🔍</span><span>🕐</span><span>+</span><span>⚙</span><span>?</span>
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">JC</div>
        </div>
      </nav>

      {/* Action bar */}
      <div className="bg-[#2563a8] text-white flex items-center h-9 px-3 gap-1 flex-shrink-0">
        <button onClick={handleApprove} disabled={!selected||approving||isApproved}
          className="text-xs font-semibold px-4 h-7 rounded border border-white/40 bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors">
          {approving?"⏳ APPROVING…":"✅ APPROVE ORDERS"}
        </button>
        {["📋 VIEW AUDIT","🖨 PRINT ORDERS","📤 REQUEST CONSULT","🗑 REJECT ENCOUNTER","🔄 REFRESH"].map(a=>(
          <button key={a} className="text-xs font-medium px-3 h-7 rounded border border-white/20 hover:bg-white/10 transition-colors">{a}</button>
        ))}
        <div className="ml-auto flex gap-4 text-xs">
          {[["Total",encounters.length,"text-white"],["Pending",pending.length,"text-red-300"],["Committed",encounters.filter(e=>e.status==="committed").length,"text-green-300"]].map(([l,v,c])=>(
            <span key={String(l)} className="flex items-center gap-1"><strong className={String(c)}>{String(v)}</strong><span className="opacity-60">{String(l)}</span></span>
          ))}
        </div>
      </div>

      {/* Patient strip */}
      {selected && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {selected.patientContext?.name.split(" ").map(n=>n[0]).join("") ?? "?"}
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">PATIENT</p>
            <p className="text-lg font-bold text-gray-900">{selected.patientContext?.name ?? "Unknown"}</p>
            <p className="text-xs text-gray-500">{selected.structuredData?.chiefComplaint} · {selected.patientContext?.patientId}</p>
          </div>
          <div className="flex gap-5 text-xs">
            <div><p className="text-gray-400">Preferred Contact</p><p className="font-semibold">Secure Message</p></div>
            <div><p className="text-gray-400">Language</p><p className="font-semibold">English</p></div>
            <div><p className="text-gray-400">Attending</p><p className="font-semibold">Dr. James Chen</p></div>
            <div><p className="text-gray-400">Auth</p><p className="font-semibold text-green-600">CPOE Verified</p></div>
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
          <Panel title={`Patients (${encounters.length})`} className="h-full">
            {pending.length > 0 && (
              <div className="border-b border-gray-100">
                <p className="text-xs font-bold text-red-600 px-3 py-1.5 bg-red-50">NEEDS APPROVAL ({pending.length})</p>
                {pending.map(e=>(
                  <button key={e.id} onClick={()=>setSelected(e)}
                    className={`w-full text-left px-3 py-2 hover:bg-red-50 border-l-2 border-l-red-400 ${selected?.id===e.id?"bg-blue-50":""}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${riskColor(e.acuity)}`}>
                        {e.patientContext?.name?.split(" ").map(n=>n[0]).join("") ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-xs truncate">{e.patientContext?.name ?? "Unknown"}</p>
                        <p className="text-gray-500 text-xs truncate">{e.structuredData?.chiefComplaint ?? "Processing…"}</p>
                        {(e.safetyFlags?.length??0)>0 && <p className="text-red-600 text-xs font-bold">⚠ {e.safetyFlags!.length} flags</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div>
              {rest.length > 0 && <p className="text-xs font-bold text-gray-400 px-3 py-1.5 border-b border-gray-100">ALL ENCOUNTERS</p>}
              {rest.map(e=>(
                <button key={e.id} onClick={()=>setSelected(e)}
                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${selected?.id===e.id?"bg-blue-50 border-l-2 border-l-[#2563a8]":"border-l-2 border-l-transparent"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${riskColor(e.acuity)}`}>
                      {e.patientContext?.name?.split(" ").map(n=>n[0]).join("") ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-xs truncate">{e.patientContext?.name ?? "Unknown"}</p>
                      <p className="text-gray-500 text-xs truncate">{e.status.replace(/_/g," ")}</p>
                    </div>
                  </div>
                </button>
              ))}
              {encounters.length === 0 && <p className="text-xs text-gray-400 italic text-center py-6">No encounters yet</p>}
            </div>
          </Panel>
        </div>

        {/* CENTER: Clinical summary */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {selected ? (
            <>
              {/* Vitals */}
              <Panel title="Vital Signs">
                <div className="px-3 py-2">
                  <div className="grid grid-cols-6 gap-2">
                    {[["Heart Rate",v.heartRate,"bpm"],["Blood Pressure",v.bloodPressure,"mmHg"],["SpO₂",v.spO2,"%"],["Temp",v.temperature,"°F"],["Resp Rate",v.respiratoryRate,"/min"],["GCS",v.gcs,"/15"]].map(([l,val,u])=>(
                      <div key={String(l)} className={`border rounded p-2 text-center ${val?"border-gray-200":"border-dashed border-gray-200 opacity-40"}`}>
                        <p className="text-xs text-gray-400">{l}</p>
                        <p className="text-base font-bold text-gray-900">{val ?? "—"}</p>
                        {val && <p className="text-xs text-gray-400">{u}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              {/* Diagnosis + History */}
              <div className="flex gap-3 flex-1 min-h-0">
                <Panel title="Clinical Assessment" className="flex-1">
                  <div className="px-3 py-2 space-y-3 text-xs overflow-auto h-full">
                    {selected.diagnosis && (
                      <>
                        <div className="pb-2 border-b border-gray-100">
                          <p className="text-gray-400">Primary Diagnosis</p>
                          <p className="font-bold text-blue-700 text-sm mt-0.5">{selected.diagnosis.primary}</p>
                          <p className="text-gray-400">ICD-10: {selected.diagnosis.icdCode} · {(selected.diagnosis.confidence*100).toFixed(0)}% confidence</p>
                          <div className="h-1.5 bg-gray-200 rounded-full mt-1"><div className="h-1.5 bg-blue-500 rounded-full" style={{width:`${selected.diagnosis.confidence*100}%`}}/></div>
                        </div>
                        <div className="pb-2 border-b border-gray-100">
                          <p className="text-gray-400 mb-1">Clinical Reasoning</p>
                          <p className="text-gray-700 leading-relaxed">{selected.diagnosis.reasoning}</p>
                        </div>
                        <div className="pb-2 border-b border-gray-100">
                          <p className="text-gray-400 mb-1">Differential Diagnoses</p>
                          <table className="w-full"><tbody>
                            {selected.diagnosis.differentials.map((d,i)=>(
                              <tr key={i} className="border-b border-gray-50 last:border-0">
                                <td className="py-1">{d.condition}</td>
                                <td className="py-1 text-right text-gray-500">{(d.probability*100).toFixed(0)}%</td>
                                <td className="py-1 pl-2 w-20"><div className="h-1 bg-gray-200 rounded-full"><div className="h-1 bg-blue-400 rounded-full" style={{width:`${d.probability*100}%`}}/></div></td>
                              </tr>
                            ))}
                          </tbody></table>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-gray-400 mb-1">Field Transcript</p>
                      <p className="text-gray-700 bg-gray-50 rounded p-2 font-mono text-xs leading-relaxed border border-gray-200">{selected.rawTranscript}</p>
                    </div>
                  </div>
                </Panel>

                <div className="w-44 flex-shrink-0 flex flex-col gap-3">
                  <Panel title="Contact Info" className="flex-1">
                    <div className="px-3 py-2 space-y-2 text-xs">
                      {[["Full Name",selected.patientContext?.name],["Patient ID",selected.patientContext?.patientId],["Age",`${selected.patientContext?.age}yo ${selected.patientContext?.sex}`],["Allergies",selected.patientContext?.allergies.join(", ")||"None"]].map(([l,v])=>(
                        <div key={String(l)}><p className="text-gray-400">{l}</p><p className={`font-medium ${String(l)==="Allergies"&&v!=="None"?"text-red-700":"text-gray-800"}`}>{String(v)??""}</p></div>
                      ))}
                      <div><p className="text-gray-400">Current Medications</p>
                        {selected.patientContext?.currentMedications.map(m=>(
                          <div key={m} className="flex items-center gap-1 text-gray-700 mb-0.5"><span className="w-1 h-1 bg-purple-400 rounded-full flex-shrink-0"/>{m}</div>
                        ))}
                      </div>
                    </div>
                  </Panel>

                  {/* Surveys-style audit summary */}
                  <Panel title="Audit" className="flex-shrink-0">
                    <div className="px-3 py-2 text-xs space-y-1">
                      {[["Field Input",selected.paramedicName],["Pipeline",`${selected.auditTrail.length} agents`],["Safety",`${selected.safetyFlags?.length??0} flags`],["Status",selected.status.replace(/_/g," ")]].map(([l,v])=>(
                        <div key={String(l)} className="flex justify-between border-b border-gray-50 pb-1">
                          <span className="text-gray-400">{l}</span>
                          <span className="font-medium text-gray-700">{String(v)}</span>
                        </div>
                      ))}
                      {selected.physicianName && <div className="flex justify-between"><span className="text-gray-400">Approved by</span><span className="font-medium text-green-700">{selected.physicianName}</span></div>}
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white border border-gray-200 rounded flex items-center justify-center">
              <div className="text-center"><div className="text-4xl mb-3">👨‍⚕️</div><p className="text-gray-400 font-medium">Select a patient to review</p><p className="text-gray-300 text-xs mt-1">Choose from the patient queue on the left</p></div>
            </div>
          )}
        </div>

        {/* RIGHT: Orders + Approval */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          <Panel title={`Draft Orders (${selected?.draftOrders?.length??0})`} className="flex-1">
            {selected?.draftOrders ? (
              <div className="px-3 py-2 space-y-2">
                {selected.draftOrders.map(o=>(
                  <div key={o.id} className={`border rounded p-2 text-xs ${o.status==="blocked"?"border-red-200 bg-red-50":o.status==="approved"?"border-green-200 bg-green-50":"border-gray-200 bg-white"}`}>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ORDER_TYPE_CLR[o.type]??ORDER_TYPE_CLR.consult}`}>{o.type}</span>
                      <span className={`text-xs font-bold uppercase ${o.urgency==="stat"?"text-red-600":"text-gray-500"}`}>{o.urgency}</span>
                      <span className={`ml-auto text-xs font-bold uppercase ${o.status==="blocked"?"text-red-700":o.status==="approved"?"text-green-700":"text-gray-500"}`}>{o.status}</span>
                    </div>
                    <p className="font-medium text-gray-900">{o.description}</p>
                    {o.medication && <p className="text-gray-500 mt-0.5">{o.medication.dosage} · {o.medication.route}</p>}
                    {o.safetyNotes && <p className="text-red-600 mt-0.5 text-xs">{o.safetyNotes}</p>}
                    {o.alternative && o.status==="blocked" && <p className="text-emerald-700 mt-0.5 font-medium">→ {o.alternative}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400 italic text-center py-6">No orders</p>}
          </Panel>

          <Panel title="Safety Flags" className="flex-shrink-0">
            {(selected?.safetyFlags?.length??0) > 0 ? (
              <div className="px-3 py-2 space-y-2">
                {selected!.safetyFlags!.map((f,i)=>(
                  <div key={i} className="bg-red-50 border border-red-100 rounded p-2 text-xs">
                    <p className="font-bold text-red-700 uppercase">{f.severity}: {f.drug}</p>
                    <p className="text-red-600">vs {f.conflictsWith}</p>
                    {f.alternative && <p className="text-emerald-700 font-medium mt-0.5">Alt: {f.alternative}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-3">{selected ? "✅ No safety flags" : "Select a patient"}</p>
            )}
          </Panel>

          <Panel title="Feedback" className="flex-shrink-0">
            <div className="px-3 py-2">
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2">{error}</p>}
              {isApproved ? (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-center text-xs">
                  <p className="font-bold text-green-700">✅ Committed to EHR</p>
                  <p className="text-green-600 mt-0.5">by {selected?.physicianName}</p>
                  <p className="text-gray-400 mt-0.5">{selected?.approvedAt ? new Date(selected.approvedAt).toLocaleString() : ""}</p>
                </div>
              ) : selected ? (
                <button onClick={handleApprove} disabled={approving}
                  className="w-full py-2.5 bg-[#2563a8] hover:bg-[#1e3f7a] text-white text-sm font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {approving ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Processing…</> : "✅ Approve & Commit to EHR"}
                </button>
              ) : <p className="text-xs text-gray-400 italic text-center">No feedback records found</p>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
