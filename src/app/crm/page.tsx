"use client";

import { useState, useEffect, useCallback } from "react";
import { Encounter } from "@/types";
import { EncounterCard } from "@/components/crm/EncounterCard";
import { EncounterDetail } from "@/components/crm/EncounterDetail";

export default function CRMCommandCenter() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEncounters = useCallback(async () => {
    try {
      const res = await fetch("/api/encounters");
      const data = await res.json();
      setEncounters(data.encounters);
      if (selected) {
        const updated = data.encounters.find((e: Encounter) => e.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch { /* silent */ }
  }, [selected]);

  useEffect(() => {
    fetchEncounters();
    const interval = setInterval(fetchEncounters, 2000);
    return () => clearInterval(interval);
  }, [fetchEncounters]);

  const handleApprove = async (encounterId: string) => {
    setIsApproving(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer dr_chen" },
        body: JSON.stringify({ encounterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelected(data.encounter);
      await fetchEncounters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setIsApproving(false);
    }
  };

  const needsAttention = encounters.filter((e) => e.status === "needs_doctor_approval");
  const active = encounters.filter((e) => !["committed", "rejected", "needs_doctor_approval"].includes(e.status));
  const completed = encounters.filter((e) => e.status === "committed");

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-gray-900">{encounters.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Encounters</p>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${needsAttention.length > 0 ? "bg-red-50 border-red-200" : "bg-white"}`}>
          <p className={`text-3xl font-bold ${needsAttention.length > 0 ? "text-red-600" : "text-gray-900"}`}>{needsAttention.length}</p>
          <p className="text-xs text-gray-500 mt-1">Pending Approval</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-amber-600">{active.length}</p>
          <p className="text-xs text-gray-500 mt-1">In Pipeline</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-green-600">{completed.length}</p>
          <p className="text-xs text-gray-500 mt-1">Committed</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-blue-600">
            {encounters.filter((e) => e.acuity === "critical").length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Critical Acuity</p>
        </div>
      </div>

      {/* Alert Banner */}
      {needsAttention.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <p className="font-bold text-sm">
            {needsAttention.length} encounter{needsAttention.length > 1 ? "s" : ""} require physician approval
          </p>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-96 flex-shrink-0 space-y-4">
          {needsAttention.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Needs Approval</h3>
              <div className="space-y-2">
                {needsAttention.map((enc) => (
                  <EncounterCard key={enc.id} encounter={enc} onSelect={setSelected} isSelected={selected?.id === enc.id} />
                ))}
              </div>
            </div>
          )}
          {[...active, ...completed].length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">All Encounters</h3>
              <div className="space-y-2">
                {[...active, ...completed].map((enc) => (
                  <EncounterCard key={enc.id} encounter={enc} onSelect={setSelected} isSelected={selected?.id === enc.id} />
                ))}
              </div>
            </div>
          )}
          {encounters.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No encounters yet.</p>
              <a href="/paramedic" className="text-sm text-blue-600 hover:text-blue-800 mt-2 block">
                Open Paramedic UI to create one
              </a>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <EncounterDetail encounter={selected} onApprove={handleApprove} isApproving={isApproving} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border p-12 text-center text-gray-400">
              <p className="text-lg">Select an encounter to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
