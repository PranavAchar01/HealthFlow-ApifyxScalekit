"use client";

import { useState, useEffect } from "react";
import { Encounter, AuditEntry } from "@/types";
import { AgentTimeline } from "@/components/ui/AgentTimeline";

export default function AuditCRM() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      const res = await fetch("/api/encounters");
      const data = await res.json();
      setEncounters(data.encounters);
    };
    fetch_();
    const interval = setInterval(fetch_, 5000);
    return () => clearInterval(interval);
  }, []);

  const allAuditEntries: (AuditEntry & { encounterId: string; patientName: string })[] = encounters.flatMap((e) =>
    e.auditTrail.map((a) => ({ ...a, encounterId: e.id, patientName: e.patientContext?.name ?? "Unknown" }))
  );

  const selected = encounters.find((e) => e.id === selectedId);
  const totalEntries = allAuditEntries.length;
  const verifiedCount = allAuditEntries.filter((a) => a.checksum).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Audit Trail</h2>
        <p className="text-sm text-gray-500">Entire.io-style immutable audit log with SHA-256 checksums</p>
      </div>

      {/* Audit Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-3xl font-bold text-gray-900">{totalEntries}</p>
          <p className="text-xs text-gray-500">Total Audit Entries</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-3xl font-bold text-emerald-600">{verifiedCount}</p>
          <p className="text-xs text-gray-500">Checksummed</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-3xl font-bold text-blue-600">{encounters.length}</p>
          <p className="text-xs text-gray-500">Encounters Tracked</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-3xl font-bold text-purple-600">
            {new Set(allAuditEntries.map((a) => a.agentRole)).size}
          </p>
          <p className="text-xs text-gray-500">Agent Types Active</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Encounter selector */}
        <div className="w-72 flex-shrink-0">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Encounters</h3>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedId(null)}
              className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                !selectedId ? "border-blue-500 bg-blue-50 font-semibold" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              All Encounters ({totalEntries} entries)
            </button>
            {encounters.map((enc) => (
              <button
                key={enc.id}
                onClick={() => setSelectedId(enc.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedId === enc.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{enc.patientContext?.name ?? "Unknown"}</p>
                <p className="text-xs text-gray-500">{enc.auditTrail.length} entries | {enc.id.substring(0, 8)}...</p>
              </button>
            ))}
          </div>
        </div>

        {/* Audit log */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {selected ? `Audit Trail: ${selected.patientContext?.name}` : "Global Audit Trail"}
              </h3>
              <span className="text-xs text-gray-400 font-mono">
                {(selected ? selected.auditTrail : allAuditEntries).length} entries
              </span>
            </div>

            {/* Raw audit table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-3">Time</th>
                    <th className="pb-2 pr-3">Agent</th>
                    <th className="pb-2 pr-3">Action</th>
                    <th className="pb-2 pr-3">User</th>
                    <th className="pb-2">Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(selected ? selected.auditTrail : allAuditEntries).map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-3 font-mono text-gray-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                          {entry.agentRole}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-medium text-gray-900">{entry.action}</td>
                      <td className="py-2 pr-3 text-gray-600">{entry.userName ?? "—"}</td>
                      <td className="py-2 font-mono text-gray-400">
                        {entry.checksum ? entry.checksum.substring(0, 12) + "..." : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Timeline view */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Timeline View</h4>
              <AgentTimeline entries={selected ? selected.auditTrail : allAuditEntries.slice(0, 20)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
