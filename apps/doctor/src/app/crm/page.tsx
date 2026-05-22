"use client";

import { useState, useEffect, useCallback } from "react";
import type { Encounter } from "@/types";
import { EncounterCard } from "@/components/crm/EncounterCard";
import { EncounterDetail } from "@/components/crm/EncounterDetail";
import { getEncounters, commitEncounter } from "@/lib/api";

export default function CommandCenter() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  const handleApprove = async (encounterId: string) => {
    setIsApproving(true);
    setError(null);
    try {
      const data = await commitEncounter(encounterId);
      setSelected(data.encounter);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setIsApproving(false);
    }
  };

  const pending = encounters.filter((e) => e.status === "needs_doctor_approval");
  const rest = encounters.filter((e) => e.status !== "needs_doctor_approval");

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: encounters.length, cls: "text-gray-900" },
          { label: "Pending", value: pending.length, cls: pending.length > 0 ? "text-red-600" : "text-gray-900" },
          { label: "Committed", value: encounters.filter((e) => e.status === "committed").length, cls: "text-green-600" },
          { label: "Critical", value: encounters.filter((e) => e.acuity === "critical").length, cls: "text-orange-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border text-center">
            <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-3 rounded-xl mb-5 flex items-center gap-3 text-sm font-bold">
          <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-white" /></span>
          {pending.length} encounter{pending.length > 1 ? "s" : ""} require physician approval
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-96 flex-shrink-0 space-y-4">
          {pending.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Needs Approval</h3>
              <div className="space-y-2">{pending.map((e) => <EncounterCard key={e.id} encounter={e} onSelect={setSelected} isSelected={selected?.id === e.id} />)}</div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">All Encounters</h3>
              <div className="space-y-2">{rest.map((e) => <EncounterCard key={e.id} encounter={e} onSelect={setSelected} isSelected={selected?.id === e.id} />)}</div>
            </div>
          )}
          {encounters.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No encounters yet. Waiting for field data...</div>}
        </div>
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
