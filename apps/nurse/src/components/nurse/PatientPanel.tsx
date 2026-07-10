"use client";
import { useState } from "react";
import type { Encounter } from "@/types";
import { AcuityPill, StatusPill, TriagePill } from "@/components/ui/badges";
import { addNursingNote, setTriageStatus, updateVitals, interpretVitals, type VitalsInterpretation } from "@/lib/api";

const CATEGORIES = ["assessment", "vitals_update", "medication", "escalation", "general"] as const;
const TRIAGE_OPTIONS = ["pending", "in_assessment", "ready_for_doctor", "escalated"] as const;

interface Props {
  encounter: Encounter;
  onUpdate: (e: Encounter) => void;
}

export function PatientPanel({ encounter, onUpdate }: Props) {
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string>("assessment");
  const [isSaving, setIsSaving] = useState(false);
  const [isTriaging, setIsTriaging] = useState(false);
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [vitalsAnalysis, setVitalsAnalysis] = useState<VitalsInterpretation | null>(null);
  const doctorUrl = process.env.NEXT_PUBLIC_DOCTOR_CRM_URL;

  const [vitalsForm, setVitalsForm] = useState(() => {
    const v = encounter.structuredData?.vitals ?? {};
    return {
      heartRate:       String(v.heartRate       ?? ""),
      bloodPressure:   String(v.bloodPressure   ?? ""),
      spO2:            String(v.spO2            ?? ""),
      temperature:     String(v.temperature     ?? ""),
      respiratoryRate: String(v.respiratoryRate ?? ""),
      gcs:             String(v.gcs             ?? ""),
    };
  });

  const handleSaveVitals = async () => {
    setIsSavingVitals(true);
    setVitalsAnalysis(null);
    try {
      const payload: Record<string, string | number> = {};
      Object.entries(vitalsForm).forEach(([k, val]) => {
        if (val.trim()) payload[k] = isNaN(Number(val)) ? val : Number(val);
      });
      const updated = await updateVitals(encounter.id, payload);
      onUpdate(updated);
      // Run AI interpretation after saving
      setIsInterpreting(true);
      try {
        const analysis = await interpretVitals(encounter.id);
        setVitalsAnalysis(analysis);
      } catch { /* non-critical */ }
      finally { setIsInterpreting(false); }
    } finally {
      setIsSavingVitals(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setIsSaving(true);
    try {
      const updated = await addNursingNote(encounter.id, note.trim(), category);
      onUpdate(updated);
      setNote("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriage = async (status: string) => {
    setIsTriaging(true);
    try {
      const updated = await setTriageStatus(encounter.id, status);
      onUpdate(updated);
    } finally {
      setIsTriaging(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Patient header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {encounter.patientContext?.name ?? "Unknown Patient"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {encounter.patientContext?.age}yo {encounter.patientContext?.sex} ·{" "}
              {encounter.patientContext?.patientId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AcuityPill acuity={encounter.acuity} />
            <StatusPill status={encounter.status} />
          </div>
        </div>

        {/* Triage selector */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Triage:</span>
          <TriagePill status={encounter.triageStatus} />
          <div className="flex gap-1 ml-2">
            {TRIAGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => handleTriage(opt)}
                disabled={isTriaging || encounter.triageStatus === opt}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                  opt === "escalated"
                    ? "border-red-300 text-red-700 hover:bg-red-50"
                    : opt === "ready_for_doctor"
                    ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          {doctorUrl && (encounter.triageStatus === "ready_for_doctor" || encounter.triageStatus === "escalated") && (
            <a
              href={doctorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              Open Doctor CRM
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Vitals */}
        <section>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Vitals</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "Heart Rate",    key: "heartRate"       as const, unit: "bpm"  },
              { label: "Blood Pressure",key: "bloodPressure"   as const, unit: "mmHg" },
              { label: "SpO₂",          key: "spO2"            as const, unit: "%"    },
              { label: "Temp",          key: "temperature"     as const, unit: "°F"   },
              { label: "Resp Rate",     key: "respiratoryRate" as const, unit: "/min" },
              { label: "GCS",           key: "gcs"             as const, unit: "/15"  },
            ] as { label: string; key: keyof typeof vitalsForm; unit: string }[]).map(({ label, key, unit }) => (
              <div key={label} className="bg-white rounded-lg border p-2.5">
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
              <div className="flex items-center gap-2">
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
        </section>

        {/* Safety flags */}
        {(encounter.safetyFlags?.length ?? 0) > 0 && (
          <section>
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
              ⚠ Safety Flags
            </h3>
            <div className="space-y-2">
              {encounter.safetyFlags!.map((flag, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-red-700 uppercase">{flag.severity}</p>
                  <p className="text-sm text-red-800 font-medium">{flag.drug} + {flag.conflictsWith}</p>
                  <p className="text-xs text-red-600 mt-0.5">{flag.description}</p>
                  {flag.alternative && (
                    <p className="text-xs text-emerald-700 font-medium mt-1">Alt: {flag.alternative}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Patient history */}
        {encounter.patientContext && (
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Patient History</h3>
            <div className="bg-white border rounded-lg p-3 space-y-1.5 text-sm">
              <p><span className="text-gray-500">Allergies:</span>{" "}
                <span className="font-medium text-red-600">
                  {encounter.patientContext.allergies.join(", ") || "None"}
                </span>
              </p>
              <p><span className="text-gray-500">Medications:</span>{" "}
                <span className="font-medium">{encounter.patientContext.currentMedications.join(", ")}</span>
              </p>
              <p><span className="text-gray-500">Conditions:</span>{" "}
                <span className="font-medium">{encounter.patientContext.conditions.join(", ")}</span>
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Note input */}
      <div className="border-t bg-white px-6 py-4">
        <div className="flex gap-2 mb-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs px-2.5 py-1 rounded-full border capitalize transition-colors ${
                category === c
                  ? "bg-teal-600 text-white border-teal-600"
                  : "border-gray-300 text-gray-600 hover:border-teal-400"
              }`}
            >
              {c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add nursing note..."
            rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
          />
          <button
            onClick={handleAddNote}
            disabled={!note.trim() || isSaving}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 disabled:opacity-50 self-end"
          >
            {isSaving ? "..." : "Add"}
          </button>
        </div>
        <button
          onClick={async () => {
            await handleSaveVitals();
            await handleTriage("ready_for_doctor");
          }}
          disabled={isSavingVitals || isTriaging}
          className="mt-2 w-full py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isSavingVitals || isTriaging ? "Finishing…" : "Finish & Send to Doctor"}
        </button>
      </div>
    </div>
  );
}
