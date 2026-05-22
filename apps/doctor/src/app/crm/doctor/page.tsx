"use client";

import { useState, useEffect, useCallback } from "react";
import { Encounter } from "@/types";
import { StatusBadge, AcuityBadge } from "@/components/ui/StatusBadge";
import { EncounterDetail } from "@/components/crm/EncounterDetail";

export default function DoctorCRM() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEncounters = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/encounters`);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/agents/commit`, {
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

  const pending = encounters.filter((e) => e.status === "needs_doctor_approval");
  const reviewed = encounters.filter((e) => e.status === "committed");

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Physician Review</h2>
        <p className="text-sm text-gray-500">Dr. James Chen | Attending Physician | CPOE Authorized</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-6">
        {/* Queue */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Pending */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider">Pending Review</h3>
              {pending.length > 0 && (
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pending.length}
                </span>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-sm text-green-700 font-medium">All clear</p>
                <p className="text-xs text-green-600">No encounters pending review</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((enc) => (
                  <button
                    key={enc.id}
                    onClick={() => setSelected(enc)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selected?.id === enc.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-red-200 bg-red-50 hover:border-red-300 animate-pulse hover:animate-none"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-900">
                        {enc.patientContext?.name ?? "Unknown"}
                      </span>
                      <AcuityBadge acuity={enc.acuity} />
                    </div>
                    <p className="text-xs text-gray-600">{enc.structuredData?.chiefComplaint}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={enc.status} />
                      {(enc.safetyFlags?.length ?? 0) > 0 && (
                        <span className="text-xs font-bold text-red-600">
                          {enc.safetyFlags!.length} SAFETY FLAG{enc.safetyFlags!.length > 1 ? "S" : ""}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reviewed */}
          {reviewed.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">
                Reviewed ({reviewed.length})
              </h3>
              <div className="space-y-2">
                {reviewed.map((enc) => (
                  <button
                    key={enc.id}
                    onClick={() => setSelected(enc)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selected?.id === enc.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-green-200 bg-green-50 hover:border-green-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {enc.patientContext?.name ?? "Unknown"}
                      </span>
                      <StatusBadge status={enc.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{enc.structuredData?.chiefComplaint}</p>
                  </button>
                ))}
              </div>
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
              <p className="text-lg mb-2">Select a case to review</p>
              <p className="text-sm">Click any encounter from the queue to view clinical details and approve orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
