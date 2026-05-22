"use client";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const SCENARIOS = [
  {
    id: "stroke",
    name: "John Martinez",
    age: 68, sex: "M", dob: "03/14/1958",
    patientId: "PT-20240001",
    phone: "(713) 555-0192",
    address: "5847 San Felipe, Suite 2600, Houston TX 77057",
    email: "j.martinez@email.com",
    language: "English",
    risk: "HIGH",
    chiefComplaint: "Suspected Stroke",
    conditions: ["Atrial Fibrillation", "Hypertension", "Type 2 Diabetes"],
    medications: ["Warfarin 5mg", "Lisinopril 10mg", "Metformin 500mg"],
    allergies: ["Penicillin"],
    avatar: "JM",
    avatarBg: "bg-blue-600",
    transcript: "68 year old male, suspected stroke, left-side paralysis, onset 20 minutes ago. Heart rate 92, blood pressure 168/94, SpO2 96%, GCS 13. Patient is alert but confused with facial droop and slurred speech. Patient is on Warfarin for atrial fibrillation.",
  },
  {
    id: "stemi",
    name: "Patricia Williams",
    age: 55, sex: "F", dob: "09/22/1970",
    patientId: "PT-20240002",
    phone: "(713) 555-0287",
    address: "1200 Main St, Houston TX 77002",
    email: "p.williams@email.com",
    language: "English",
    risk: "HIGH",
    chiefComplaint: "Acute Chest Pain / STEMI",
    conditions: ["Hypertension", "Hyperlipidemia"],
    medications: ["Atorvastatin 40mg", "Amlodipine 5mg"],
    allergies: ["Sulfa"],
    avatar: "PW",
    avatarBg: "bg-red-600",
    transcript: "55 year old female, acute crushing chest pain radiating to left arm, onset 35 minutes ago. Diaphoretic and pale. Heart rate 108, blood pressure 88/60, SpO2 94%, GCS 15. No prior cardiac history. 12-lead shows ST elevation V1-V4. Nitroglycerin administered in field.",
  },
  {
    id: "trauma",
    name: "Marcus Johnson",
    age: 32, sex: "M", dob: "06/05/1993",
    patientId: "PT-20240003",
    phone: "(713) 555-0341",
    address: "4500 Westheimer Rd, Houston TX 77027",
    email: "m.johnson@email.com",
    language: "English",
    risk: "MED",
    chiefComplaint: "Blunt Trauma — MVA",
    conditions: [],
    medications: [],
    allergies: [],
    avatar: "MJ",
    avatarBg: "bg-orange-600",
    transcript: "32 year old male, restrained driver in high-speed motor vehicle accident. Airbag deployed. Complains of chest pain and right leg pain. Heart rate 118, blood pressure 102/72, SpO2 97%, GCS 14. Right thigh deformity visible, suspected femur fracture. Cervical spine precautions in place.",
  },
  {
    id: "resp",
    name: "Dorothy Chen",
    age: 74, sex: "F", dob: "02/18/1951",
    patientId: "PT-20240004",
    phone: "(713) 555-0419",
    address: "2800 Kirby Dr, Houston TX 77098",
    email: "d.chen@email.com",
    language: "English",
    risk: "HIGH",
    chiefComplaint: "Acute Respiratory Distress",
    conditions: ["COPD", "Congestive Heart Failure"],
    medications: ["Furosemide 40mg", "Albuterol inhaler", "Tiotropium"],
    allergies: ["Aspirin", "NSAIDs"],
    avatar: "DC",
    avatarBg: "bg-purple-600",
    transcript: "74 year old female with known COPD and CHF presenting with acute respiratory distress. Respiratory rate 28, using accessory muscles. Heart rate 122, blood pressure 152/88, SpO2 82% on room air, improved to 91% on 6L O2. Bilateral crackles. Has allergy to Aspirin and NSAIDs.",
  },
  {
    id: "diabetic",
    name: "Robert Kim",
    age: 47, sex: "M", dob: "11/30/1977",
    patientId: "PT-20240005",
    phone: "(713) 555-0563",
    address: "9100 Bellaire Blvd, Houston TX 77036",
    email: "r.kim@email.com",
    language: "Korean/English",
    risk: "MED",
    chiefComplaint: "Diabetic Emergency / Hypoglycemia",
    conditions: ["Type 1 Diabetes", "Hypothyroidism"],
    medications: ["Insulin Glargine", "Levothyroxine 50mcg"],
    allergies: [],
    avatar: "RK",
    avatarBg: "bg-teal-600",
    transcript: "47 year old male, insulin-dependent diabetic found unresponsive by family. Blood glucose 28 mg/dL. Diaphoretic, confused, GCS 10. Heart rate 98, blood pressure 138/82, SpO2 98%. D50 administered in field, improving. Family reports patient skipped meals today. Insulin Glargine taken this morning.",
  },
];

type EncounterResult = {
  id: string; status: string; acuity: string;
  chiefComplaint?: string; diagnosis?: string; confidence?: number;
  safetyFlags: number; orders: number; auditEntries: number;
};

export default function NineOneOne() {
  const [selected, setSelected] = useState<typeof SCENARIOS[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EncounterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const launchScenario = async (scenario: typeof SCENARIOS[0]) => {
    setSelected(scenario);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/agents/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer paramedic_sarah" },
        body: JSON.stringify({ transcript: scenario.transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const e = data.encounter;
      setResult({
        id: e.id, status: e.status, acuity: e.acuity,
        chiefComplaint: e.structuredData?.chiefComplaint,
        diagnosis: e.diagnosis?.primary,
        confidence: e.diagnosis?.confidence,
        safetyFlags: e.safetyFlags?.length ?? 0,
        orders: e.draftOrders?.length ?? 0,
        auditEntries: e.auditTrail?.length ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setLoading(false);
    }
  };

  const NURSE_URL = process.env.NEXT_PUBLIC_NURSE_URL ?? "https://nurse-seven.vercel.app";
  const DOCTOR_URL = process.env.NEXT_PUBLIC_DOCTOR_CRM_URL ?? "https://healthflow-doctor.vercel.app/crm";

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Nav */}
      <nav className="bg-[#1e3f7a] text-white flex items-center h-10 px-3 gap-3 flex-shrink-0">
        <div className="grid grid-cols-3 gap-0.5 w-5 h-5 flex-shrink-0">
          {Array.from({length:9}).map((_,i)=><div key={i} className="w-1.5 h-1.5 bg-white rounded-sm opacity-80"/>)}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="opacity-70">HealthFlow</span>
          <span className="opacity-40 mx-1">›</span>
          <span className="opacity-70">Emergency</span>
          <span className="opacity-40 mx-1">›</span>
          <span className="font-semibold">911 Dispatch</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm opacity-80">
          <span>🔍</span><span>🕐</span><span>⚙</span>
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">D</div>
        </div>
      </nav>

      {/* Action Bar */}
      <div className="bg-[#2563a8] text-white flex items-center h-9 px-4 gap-1 flex-shrink-0">
        {["🚨 NEW INCIDENT","📋 PATIENT HISTORY","🖨 PRINT REPORT","🔄 REFRESH"].map(btn=>(
          <button key={btn} className="flex items-center gap-1.5 text-xs font-medium px-3 h-7 rounded border border-white/20 hover:bg-white/10 transition-colors">
            {btn}
          </button>
        ))}
        <div className="ml-auto text-xs opacity-70">
          Dispatcher: Sarah Mitchell · Unit 42 · {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left: Patient Selector */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2">
          <div className="bg-white border border-gray-200 rounded">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <span className="text-[#00a99d] font-semibold text-xs tracking-wide uppercase">Preset Patients</span>
              <span className="text-gray-400 text-xs">{SCENARIOS.length} records</span>
            </div>
            <div className="divide-y divide-gray-100">
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  onClick={() => launchScenario(s)}
                  disabled={loading}
                  className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5 ${selected?.id === s.id ? "bg-blue-50 border-l-2 border-l-[#2563a8]" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full ${s.avatarBg} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>{s.avatar}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">{s.name}</p>
                    <p className="text-gray-500 text-xs truncate">{s.age}yo · {s.chiefComplaint}</p>
                  </div>
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    s.risk === "HIGH" ? "bg-red-100 text-red-700" :
                    s.risk === "MED" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                  }`}>{s.risk}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Patient Detail */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {selected ? (
            <>
              {/* Patient header card */}
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
                    <div><p className="text-gray-400 text-xs">Preferred Contact</p><p className="font-medium">Secure Message</p></div>
                    <div><p className="text-gray-400 text-xs">Language</p><p className="font-medium">{selected.language}</p></div>
                    <div><p className="text-gray-400 text-xs">Risk Level</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${
                        selected.risk === "HIGH" ? "bg-red-500" : selected.risk === "MED" ? "bg-orange-500" : "bg-green-500"
                      }`}>{selected.risk}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two column detail */}
              <div className="flex gap-3 flex-1">
                {/* Contact Info */}
                <div className="w-56 flex-shrink-0">
                  <div className="bg-white border border-gray-200 rounded h-full">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Contact Info</span>
                      <button className="text-[#2563a8] text-lg leading-none">+</button>
                    </div>
                    <div className="px-3 py-2 space-y-2 text-xs">
                      {[
                        ["Full Name", selected.name],
                        ["Patient ID", selected.patientId],
                        ["Cell Phone", selected.phone],
                        ["Address", selected.address],
                        ["Email", selected.email],
                        ["Date of Birth", `${selected.dob} (${selected.age})`],
                        ["Sex", selected.sex === "M" ? "Male" : "Female"],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p className="text-gray-400">{label}</p>
                          <p className="text-gray-800 font-medium break-words">{val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 px-3 py-2">
                      <p className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide mb-2">Medical History</p>
                      {selected.conditions.length > 0 ? selected.conditions.map(c=>(
                        <div key={c} className="text-xs text-gray-700 flex items-center gap-1 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"/>
                          {c}
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">No prior conditions</p>}
                    </div>
                  </div>
                </div>

                {/* Field Transcript */}
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-gray-200 rounded h-full flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Field Transcript</span>
                      <div className="flex gap-2">
                        {["Timeline","Notes"].map(t=><button key={t} className="text-xs text-gray-500 hover:text-gray-700">{t}</button>)}
                      </div>
                    </div>
                    <div className="p-3 flex-1">
                      <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 font-mono leading-relaxed mb-3 border border-gray-200">
                        {selected.transcript}
                      </div>

                      {/* Medications + Allergies */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Current Medications</p>
                          {selected.medications.length > 0 ? selected.medications.map(m=>(
                            <div key={m} className="text-xs text-gray-700 flex items-center gap-1 mb-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"/>
                              {m}
                            </div>
                          )) : <p className="text-xs text-gray-400 italic">None</p>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Allergies</p>
                          {selected.allergies.length > 0 ? selected.allergies.map(a=>(
                            <div key={a} className="text-xs text-red-700 flex items-center gap-1 mb-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"/>
                              {a}
                            </div>
                          )) : <p className="text-xs text-gray-400 italic">None known</p>}
                        </div>
                      </div>

                      <button
                        onClick={() => launchScenario(selected)}
                        disabled={loading}
                        className="w-full py-2.5 bg-[#2563a8] hover:bg-[#1e3f7a] text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Running Pipeline...</>
                        ) : "🚨 Launch Emergency Pipeline"}
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
                          <span className="font-medium text-blue-700 capitalize">{result.status.replace(/_/g," ")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Acuity</span>
                          <span className={`font-bold uppercase px-1.5 py-0.5 rounded text-xs ${
                            result.acuity === "critical" ? "bg-red-100 text-red-700" :
                            result.acuity === "high" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                          }`}>{result.acuity}</span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-400">Orders</span><span className="font-medium">{result.orders}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Safety Flags</span>
                          <span className={`font-bold ${result.safetyFlags > 0 ? "text-red-600" : "text-gray-700"}`}>{result.safetyFlags}</span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-400">Audit Entries</span><span className="font-medium">{result.auditEntries}</span></div>
                        {result.confidence && (
                          <div>
                            <div className="flex justify-between mb-0.5"><span className="text-gray-400">Dx Confidence</span><span className="font-medium">{(result.confidence*100).toFixed(0)}%</span></div>
                            <div className="h-1 bg-gray-200 rounded-full"><div className="h-1 bg-blue-500 rounded-full" style={{width:`${result.confidence*100}%`}}/></div>
                          </div>
                        )}
                        {result.diagnosis && <div><p className="text-gray-400">Diagnosis</p><p className="font-medium text-gray-800 text-xs">{result.diagnosis}</p></div>}
                      </div>
                    ) : loading ? (
                      <div className="px-3 py-6 text-center text-xs text-gray-400">
                        <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Running agents...
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-gray-400 italic">Click Launch to run pipeline</div>
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
                          🏥 Nurse Station
                        </a>
                        <a href={DOCTOR_URL} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold bg-[#2563a8] text-white rounded hover:bg-[#1e3f7a] transition-colors">
                          👨‍⚕️ Doctor CRM
                        </a>
                        <a href={`https://healthflow-paramedic.vercel.app`} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors">
                          🚑 Paramedic View
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
                <div className="text-5xl mb-4">🚨</div>
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
