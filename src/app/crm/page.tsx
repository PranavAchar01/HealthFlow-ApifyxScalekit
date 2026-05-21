"use client";

import { useState, useEffect, useCallback } from "react";
import { Encounter } from "@/types";
import { EncounterCard } from "@/components/crm/EncounterCard";
import { EncounterDetail } from "@/components/crm/EncounterDetail";
import Link from "next/link";

export default function CRMPage() {
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
    } catch {
      // silent retry
    }
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
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer dr_chen",
        },
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
  const otherEncounters = encounters.filter((e) => e.status !== "needs_doctor_approval");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
              GF
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">GuestFlow CRM</h1>
              <p className="text-xs text-gray-500">Hospital Command Center</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/paramedic" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Paramedic View
            </Link>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Dr. James Chen</p>
                <p className="text-xs text-gray-500">Attending Physician | CPOE</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                JC
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Alert Banner */}
      {needsAttention.length > 0 && (
        <div className="bg-red-600 text-white px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
            <p className="font-bold">
              {needsAttention.length} encounter{needsAttention.length > 1 ? "s" : ""} require physician approval
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar - Encounter List */}
          <div className="w-96 flex-shrink-0 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-gray-900">{encounters.length}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-red-600">{needsAttention.length}</p>
                <p className="text-xs text-red-600">Pending</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-green-600">
                  {encounters.filter((e) => e.status === "committed").length}
                </p>
                <p className="text-xs text-green-600">Committed</p>
              </div>
            </div>

            {/* Needs Attention */}
            {needsAttention.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider mb-2">
                  Needs Approval
                </h3>
                <div className="space-y-2">
                  {needsAttention.map((enc) => (
                    <EncounterCard
                      key={enc.id}
                      encounter={enc}
                      onSelect={setSelected}
                      isSelected={selected?.id === enc.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other Encounters */}
            {otherEncounters.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
                  All Encounters
                </h3>
                <div className="space-y-2">
                  {otherEncounters.map((enc) => (
                    <EncounterCard
                      key={enc.id}
                      encounter={enc}
                      onSelect={setSelected}
                      isSelected={selected?.id === enc.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {encounters.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-2">No encounters yet</p>
                <Link
                  href="/paramedic"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Open Paramedic UI to create one
                </Link>
              </div>
            )}
          </div>

          {/* Main - Encounter Detail */}
          <div className="flex-1 min-w-0">
            {selected ? (
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <EncounterDetail
                  encounter={selected}
                  onApprove={handleApprove}
                  isApproving={isApproving}
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
                <div className="text-gray-300 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-gray-400 text-lg">Select an encounter to review</p>
                <p className="text-gray-300 text-sm mt-1">
                  Click on any encounter card to view details and take action
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
