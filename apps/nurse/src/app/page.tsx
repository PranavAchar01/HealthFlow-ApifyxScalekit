"use client";

import { useState, useEffect, useCallback } from "react";
import type { Encounter } from "@/types";
import { getEncounters } from "@/lib/api";
import { EncounterRow } from "@/components/nurse/EncounterRow";
import { PatientPanel } from "@/components/nurse/PatientPanel";

type Filter = "all" | "critical" | "pending_triage" | "needs_doctor" | "done";

export default function NurseStation() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    try {
      const list = await getEncounters();
      setEncounters(list);
      if (selected) {
        const updated = list.find((e) => e.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch { /* silent */ }
  }, [selected]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleUpdate = (updated: Encounter) => {
    setSelected(updated);
    setEncounters((prev) => prev.map((e) => e.id === updated.id ? updated : e));
  };

  const filtered = encounters.filter((e) => {
    if (filter === "critical") return e.acuity === "critical" || e.acuity === "high";
    if (filter === "pending_triage") return !e.triageStatus || e.triageStatus === "pending";
    if (filter === "needs_doctor") return e.status === "needs_doctor_approval" || e.triageStatus === "escalated" || e.triageStatus === "ready_for_doctor";
    if (filter === "done") return e.status === "committed";
    return true;
  });

  const criticalCount = encounters.filter((e) => e.acuity === "critical").length;
  const pendingTriageCount = encounters.filter((e) => !e.triageStatus || e.triageStatus === "pending").length;
  const needsDoctorCount = encounters.filter((e) => e.status === "needs_doctor_approval" || e.triageStatus === "escalated").length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-teal-800 text-white shadow-lg">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-sm">GF</div>
            <div>
              <h1 className="font-bold text-sm">GuestFlow Nurse Station</h1>
              <p className="text-teal-200 text-xs">Triage · Assessment · Handoff</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
            </span>
            <div className="text-right">
              <p className="text-sm font-medium">Maria Rodriguez, RN</p>
              <p className="text-teal-300 text-xs">ED Charge Nurse · Bay 3</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">MR</div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="border-t border-teal-700 px-6 py-2 flex items-center gap-6 text-sm">
          {[
            { label: "Total", value: encounters.length, color: "text-white" },
            { label: "Critical", value: criticalCount, color: criticalCount > 0 ? "text-red-300 font-bold" : "text-teal-200" },
            { label: "Awaiting Triage", value: pendingTriageCount, color: pendingTriageCount > 0 ? "text-yellow-300" : "text-teal-200" },
            { label: "Ready for Doctor", value: needsDoctorCount, color: needsDoctorCount > 0 ? "text-orange-300" : "text-teal-200" },
            { label: "Committed", value: encounters.filter((e) => e.status === "committed").length, color: "text-teal-200" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`font-bold text-lg ${s.color}`}>{s.value}</span>
              <span className="text-teal-300 text-xs">{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 96px)" }}>
        {/* Sidebar — triage queue */}
        <div className="w-80 flex-shrink-0 bg-white border-r flex flex-col">
          {/* Filter tabs */}
          <div className="border-b px-3 py-2 flex gap-1 overflow-x-auto">
            {([
              ["all", "All"],
              ["critical", `Critical ${criticalCount > 0 ? `(${criticalCount})` : ""}`],
              ["pending_triage", `Triage ${pendingTriageCount > 0 ? `(${pendingTriageCount})` : ""}`],
              ["needs_doctor", `Doctor ${needsDoctorCount > 0 ? `(${needsDoctorCount})` : ""}`],
              ["done", "Done"],
            ] as [Filter, string][]).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                  filter === f ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Encounter list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No encounters in this view</p>
              </div>
            ) : (
              filtered.map((e) => (
                <EncounterRow
                  key={e.id}
                  encounter={e}
                  isSelected={selected?.id === e.id}
                  onSelect={setSelected}
                />
              ))
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            <PatientPanel encounter={selected} onUpdate={handleUpdate} />
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <div className="text-5xl mb-4">🏥</div>
                <p className="text-gray-400 text-lg font-medium">Select a patient to begin assessment</p>
                <p className="text-gray-300 text-sm mt-1">Click any encounter from the triage queue</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
