"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from '@healthflow/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Result = {
  encounterId: string; status: string; acuity: string;
  chiefComplaint?: string; diagnosis?: string; confidence?: number;
  reasoning?: string; safetyFlags: { drug: string; conflictsWith: string; severity: string; description: string; alternative?: string }[];
  orders: { description: string; type: string; urgency: string; status: string }[];
  auditEntries: number;
};

type LiveEncounter = {
  id: string;
  status: string;
  acuity: string;
  createdAt: string;
  updatedAt: string;
  paramedicName: string;
  structuredData?: { chiefComplaint?: string; vitals?: Record<string, unknown> };
  patientContext?: { name?: string; age?: number; sex?: string };
  diagnosis?: { primary?: string; confidence?: number; reasoning?: string };
  draftOrders?: { description: string; type: string; urgency: string; status: string }[];
  safetyFlags?: { drug: string; conflictsWith: string; severity: string; description: string; alternative?: string }[];
  auditTrail?: unknown[];
};

function TopNav({ subtitle }: { subtitle: string }) {
  return (
    <nav className="bg-[#1e3f7a] text-white flex items-center h-10 px-3 gap-3 flex-shrink-0">
      <div className="grid grid-cols-3 gap-0.5 w-5 h-5 flex-shrink-0">
        {Array.from({length:9}).map((_,i)=><div key={i} className="w-1.5 h-1.5 bg-white rounded-sm opacity-80"/>)}
      </div>
      <div className="flex items-center gap-1 text-sm">
        <span className="opacity-60">HealthFlow</span><span className="opacity-30 mx-1">›</span>
        <span className="opacity-60">Field</span><span className="opacity-30 mx-1">›</span>
        <span className="font-semibold">{subtitle}</span>
      </div>
      <div className="ml-auto flex items-center gap-3 text-sm opacity-70">
        <span>🔍</span><span>⚙</span>
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">SM</div>
      </div>
    </nav>
  );
}

function ActionBar({ actions }: { actions: string[] }) {
  return (
    <div className="bg-[#2563a8] text-white flex items-center h-9 px-3 gap-1 flex-shrink-0">
      {actions.map(a => (
        <button key={a} className="text-xs font-medium px-3 h-7 rounded border border-white/20 hover:bg-white/10 transition-colors whitespace-nowrap">{a}</button>
      ))}
    </div>
  );
}

function Panel({ title, children, className="" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <span className="text-[#00a99d] font-bold text-xs tracking-widest uppercase">{title}</span>
        <button className="text-[#2563a8] text-base leading-none font-bold">+</button>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export default function ParamedicApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveEncounters, setLiveEncounters] = useState<LiveEncounter[]>([]);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Live stream + polling fallback. SSE delivers updates when the paramedic
  // browser lands on the same lambda as the pipeline; 2s polling covers the
  // cross-lambda case so dispatches always show up within ~2s.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fetchAll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/encounters`, {
          headers: { Authorization: "Bearer paramedic_sarah" },
        });
        const data = await res.json();
        if (Array.isArray(data.encounters)) setLiveEncounters(data.encounters.slice(0, 10));
      } catch {}
    };

    const upsert = (e: LiveEncounter) => setLiveEncounters(prev => {
      const i = prev.findIndex(x => x.id === e.id);
      if (i === -1) return [e, ...prev].slice(0, 10);
      const next = [...prev]; next[i] = e; return next;
    });

    const es = new EventSource(`${API_URL}/api/encounters/stream`);
    es.addEventListener("snapshot", (ev) => {
      try {
        const { encounters } = JSON.parse((ev as MessageEvent).data) as { encounters: LiveEncounter[] };
        setLiveEncounters(encounters.slice(0, 10));
      } catch {}
    });
    es.addEventListener("upsert", (ev) => {
      try { upsert(JSON.parse((ev as MessageEvent).data) as LiveEncounter); } catch {}
    });
    es.addEventListener("delete", (ev) => {
      try {
        const { id } = JSON.parse((ev as MessageEvent).data) as { id: string };
        setLiveEncounters(prev => prev.filter(e => e.id !== id));
      } catch {}
    });

    fetchAll();
    const poll = setInterval(fetchAll, 2000);

    return () => { es.close(); clearInterval(poll); };
  }, []);

  const loadIncoming = (e: LiveEncounter) => {
    setResult({
      encounterId: e.id,
      status: e.status,
      acuity: e.acuity,
      chiefComplaint: e.structuredData?.chiefComplaint,
      diagnosis: e.diagnosis?.primary,
      confidence: e.diagnosis?.confidence,
      reasoning: e.diagnosis?.reasoning,
      safetyFlags: e.safetyFlags ?? [],
      orders: e.draftOrders ?? [],
      auditEntries: e.auditTrail?.length ?? 0,
    });
  };

  // When an encounter we're viewing gets updated by the stream, keep the result in sync
  useEffect(() => {
    if (!result) return;
    const live = liveEncounters.find(e => e.id === result.encounterId);
    if (!live) return;
    setResult(r => r && r.encounterId === live.id ? {
      ...r,
      status: live.status, acuity: live.acuity,
      chiefComplaint: live.structuredData?.chiefComplaint ?? r.chiefComplaint,
      diagnosis: live.diagnosis?.primary ?? r.diagnosis,
      confidence: live.diagnosis?.confidence ?? r.confidence,
      reasoning: live.diagnosis?.reasoning ?? r.reasoning,
      safetyFlags: live.safetyFlags ?? r.safetyFlags,
      orders: live.draftOrders ?? r.orders,
      auditEntries: live.auditTrail?.length ?? r.auditEntries,
    } : r);
  }, [liveEncounters, result?.encounterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRec = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mrRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData(); fd.append("audio", blob, "rec.webm");
          const res = await fetch(`${API_URL}/api/voice/transcribe`, { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setTranscript(p => p ? p + " " + data.text : data.text);
        } catch (e) { setError(`Transcription: ${e instanceof Error ? e.message : "failed"}`); }
        finally { setIsTranscribing(false); }
      };
      mr.start(250); setIsRecording(true);
    } catch { setError("Mic access denied — type below"); }
  }, []);

  const stopRec = useCallback(() => { mrRef.current?.stop(); setIsRecording(false); }, []);

  const handleSubmit = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/agents/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer paramedic_sarah" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const e = data.encounter;
      setResult({
        encounterId: e.id, status: e.status, acuity: e.acuity,
        chiefComplaint: e.structuredData?.chiefComplaint,
        diagnosis: e.diagnosis?.primary, confidence: e.diagnosis?.confidence,
        reasoning: e.diagnosis?.reasoning,
        safetyFlags: e.safetyFlags ?? [],
        orders: e.draftOrders ?? [],
        auditEntries: e.auditTrail?.length ?? 0,
      });

      // Write ALL pipeline results back to HealthFlow_transcript (fire-and-forget).
      // Match by patientId so the 911, nurse, and doctor views all see the update.
      const patientId = e.patientContext?.patientId;
      if (patientId) {
        supabase
          .from('HealthFlow_transcript')
          .update({
            structuredData      : JSON.stringify(e.structuredData      ?? null),
            diagnosis           : JSON.stringify(e.diagnosis           ?? null),
            draftOrders         : JSON.stringify(e.draftOrders         ?? []),
            safetyFlags         : JSON.stringify(e.safetyFlags         ?? []),
            safetyRecommendation: e.safetyRecommendation ?? null,
            auditTrail          : JSON.stringify(e.auditTrail          ?? []),
            status              : e.status,
            acuity              : e.acuity,
            encounterId         : e.id,
            updatedAt           : new Date().toISOString(),
          })
          .eq('patientId', patientId)
          .then(({ error }) => {
            if (error) console.error('[paramedic] HealthFlow_transcript write-back error:', error);
          });
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setIsProcessing(false); }
  };

  const words = transcript.split(/\s+/).filter(Boolean).length;
  const NURSE_URL = process.env.NEXT_PUBLIC_NURSE_URL ?? "https://nurse-seven.vercel.app";
  const DOCTOR_URL = process.env.NEXT_PUBLIC_DOCTOR_CRM_URL ?? "https://guestflow-doctor.vercel.app";

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:"13px"}}>
      <TopNav subtitle="Sarah Mitchell · Unit 42" />
      <ActionBar actions={["🎙 START DICTATION","⏹ STOP RECORDING","📤 SUBMIT TO PIPELINE","🗑 CLEAR TRANSCRIPT","🖨 PRINT REPORT"]} />

      {/* Patient card strip — driven by live dispatch */}
      {(() => {
        const live = result ? liveEncounters.find(e => e.id === result.encounterId) : undefined;
        const name = live?.patientContext?.name ?? (result?.chiefComplaint ? "Incoming…" : null);
        const initials = name && name !== "Incoming…" ? name.split(" ").map(s => s[0]).join("").slice(0,2) : "?";
        const ageSex = live?.patientContext ? `${live.patientContext.age}yo ${live.patientContext.sex}` : null;
        const inFlight = result && result.status !== "committed" && result.status !== "approved";
        return (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
            <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0 ${name && name !== "Incoming…" ? "bg-blue-600" : "bg-gray-400"}`}>{initials}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">PATIENT</p>
                {inFlight && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"/>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"/>
                    </span>
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-gray-800">
                {name ?? "Unknown — Pending Identification"}
                {ageSex && <span className="text-sm text-gray-500 font-normal ml-2">{ageSex}</span>}
              </p>
            </div>
            <div className="flex gap-6 text-xs">
              <div><p className="text-gray-400">Unit</p><p className="font-semibold">Unit 42</p></div>
              <div><p className="text-gray-400">Dispatcher</p><p className="font-semibold">Dispatch 9</p></div>
              <div><p className="text-gray-400">Risk Level</p>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${
                  result?.acuity === "critical" ? "bg-red-500" : result?.acuity === "high" ? "bg-orange-500" : result?.acuity === "medium" ? "bg-yellow-500" : "bg-gray-400"
                }`}>{result ? result.acuity.toUpperCase() : "—"}</span>
              </div>
              <div><p className="text-gray-400">Status</p><p className="font-semibold capitalize">{result?.status.replace(/_/g," ") ?? "Ready"}</p></div>
            </div>
          </div>
        );
      })()}

      {/* Main 3-col layout */}
      <div className="flex flex-1 overflow-hidden p-3 gap-3">

        {/* LEFT: Paramedic + live dispatches */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3">
          <Panel title="Paramedic" className="flex-shrink-0">
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">SM</div>
                <div>
                  <p className="font-semibold text-gray-900 text-xs">Sarah Mitchell</p>
                  <p className="text-xs text-gray-400">Unit 42 · AEMT</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[["Shift","Day"],["Station","9"],["Radio","CH-4"],["Status","Active"]].map(([l,v])=>(
                  <div key={l}><p className="text-gray-400">{l}</p><p className="font-medium text-gray-800">{v}</p></div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title={`Live Dispatches (${liveEncounters.length})`} className="flex-1">
            <div className="divide-y divide-gray-50">
              {liveEncounters.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-6 px-3">
                  Awaiting dispatch…<br/>
                  <span className="text-gray-300">Live feed from 911 + field units</span>
                </p>
              )}
              {liveEncounters.map(e => {
                const isActive = result?.encounterId === e.id;
                const acuityClr = e.acuity === "critical" ? "bg-red-500"
                  : e.acuity === "high" ? "bg-orange-500"
                  : e.acuity === "medium" ? "bg-yellow-500" : "bg-green-500";
                const stage = e.status.replace(/_/g," ");
                const inFlight = !["committed","approved"].includes(e.status);
                return (
                  <button key={e.id} onClick={() => loadIncoming(e)}
                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${isActive?"bg-blue-50 border-l-2 border-l-[#2563a8]":""}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${acuityClr} ${inFlight ? "animate-pulse" : ""}`}/>
                      <p className="font-semibold text-gray-900 text-xs truncate flex-1">
                        {e.patientContext?.name ?? "Incoming…"}
                      </p>
                      <span className="text-xs text-gray-400">
                        {new Date(e.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5 pl-4">
                      {e.structuredData?.chiefComplaint ?? "processing…"}
                    </p>
                    <p className="text-xs pl-4 mt-0.5">
                      <span className={`capitalize ${inFlight ? "text-blue-600 font-medium" : "text-gray-400"}`}>{stage}</span>
                      {(e.safetyFlags?.length ?? 0) > 0 && <span className="text-red-600 font-bold ml-1">⚠{e.safetyFlags!.length}</span>}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* CENTER: Voice capture */}
        <div className="flex-1 min-w-0">
          <Panel title="Voice Capture — Agent 1 (ElevenLabs Scribe)" className="h-full">
            <div className="px-3 py-2 flex flex-col h-full gap-2">
              {/* Controls */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 flex-shrink-0">
                <button
                  onClick={isRecording ? stopRec : startRec}
                  disabled={isProcessing || isTranscribing}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-all disabled:opacity-50 ${isRecording ? "bg-red-500 animate-pulse" : "bg-[#2563a8] hover:bg-[#1e3f7a]"}`}
                >
                  <span>{isRecording ? "⏹" : "🎙"}</span>
                  {isRecording ? "Stop Recording" : "Start Dictation"}
                </button>
                {isRecording && <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"/></span>}
                {isTranscribing && <span className="text-xs text-blue-600 flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Transcribing…</span>}
                <span className="ml-auto text-xs text-gray-400">{words} words · ElevenLabs Scribe v1</span>
              </div>

              {/* Transcript area - takes remaining space */}
              <div className="relative flex-1 min-h-0">
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder={"Dictate patient vitals and clinical observations...\n\nExample: 68yo male, suspected stroke, left-side hemiparesis onset 20 min ago, HR 92, BP 168/94, SpO2 96%, GCS 13, facial droop and slurred speech."}
                  className="w-full h-full resize-none text-xs border border-gray-200 rounded p-3 font-mono focus:border-[#2563a8] focus:ring-1 focus:ring-blue-200 bg-gray-50"
                />
                {isRecording && <div className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"/></div>}
              </div>

              {/* Submit */}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setTranscript("")} className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50">Clear</button>
                <button
                  onClick={handleSubmit}
                  disabled={!transcript.trim() || isProcessing || isTranscribing}
                  className="flex-1 py-1.5 bg-[#2563a8] hover:bg-[#1e3f7a] text-white text-xs font-semibold rounded disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Running 9-Agent Pipeline…</> : "📤 Submit to Agent Pipeline"}
                </button>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
            </div>
          </Panel>
        </div>

        {/* RIGHT: Results */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          <Panel title="Pipeline Result" className="flex-1">
            {result ? (
              <div className="px-3 py-2 space-y-2 text-xs">
                <div className="pb-2 border-b border-gray-100">
                  <p className="text-gray-400 mb-0.5">Chief Complaint</p>
                  <p className="font-semibold text-gray-900">{result.chiefComplaint}</p>
                </div>
                <div className="pb-2 border-b border-gray-100">
                  <p className="text-gray-400 mb-0.5">AI Diagnosis</p>
                  <p className="font-semibold text-blue-700">{result.diagnosis}</p>
                  {result.confidence && (
                    <div className="mt-1">
                      <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-400">Confidence</span><span className="font-medium">{(result.confidence*100).toFixed(0)}%</span></div>
                      <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-1.5 bg-blue-500 rounded-full" style={{width:`${result.confidence*100}%`}}/></div>
                    </div>
                  )}
                  {result.reasoning && <p className="text-gray-500 mt-1 text-xs leading-relaxed">{result.reasoning}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-100">
                  {[["Orders",result.orders.length,"text-gray-900"],["Agents",result.auditEntries,"text-gray-900"],["Flags",result.safetyFlags.length,result.safetyFlags.length>0?"text-red-600":"text-gray-900"],["Acuity",result.acuity.toUpperCase(),result.acuity==="critical"?"text-red-700 font-bold":"text-gray-900"]].map(([l,v,cls])=>(
                    <div key={String(l)} className="bg-gray-50 rounded p-2 text-center">
                      <p className={`font-bold text-base ${cls}`}>{String(v)}</p>
                      <p className="text-gray-400 text-xs">{String(l)}</p>
                    </div>
                  ))}
                </div>
                {result.safetyFlags.length > 0 && (
                  <div className="pb-2 border-b border-gray-100">
                    <p className="text-red-600 font-bold text-xs uppercase mb-1">⚠ Safety Flags</p>
                    {result.safetyFlags.map((f,i)=>(
                      <div key={i} className="bg-red-50 border border-red-100 rounded p-1.5 mb-1 text-xs">
                        <p className="font-bold text-red-700">{f.severity.toUpperCase()}: {f.drug}</p>
                        <p className="text-red-600">{f.description.substring(0,80)}...</p>
                        {f.alternative && <p className="text-emerald-700 font-medium">→ {f.alternative}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-xs text-gray-400 italic">Submit transcript to see results</div>
            )}
          </Panel>

          <Panel title="Handoff" className="flex-shrink-0">
            <div className="px-3 py-2 space-y-2">
              <a href={NURSE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700 transition-colors">
                <span>🏥</span><span>Nurse Station</span>
                <span className="ml-auto">›</span>
              </a>
              <a href={DOCTOR_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-[#2563a8] text-white rounded text-xs font-semibold hover:bg-[#1e3f7a] transition-colors">
                <span>👨‍⚕️</span><span>Doctor CRM</span>
                <span className="ml-auto">›</span>
              </a>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
