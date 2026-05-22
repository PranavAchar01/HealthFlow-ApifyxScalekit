"use client";

import { useState, useEffect } from "react";
import { Encounter } from "@/types";
import { StatusBadge, AcuityBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";

export default function FieldOpsCRM() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);

  useEffect(() => {
    const fetch_ = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/encounters`);
      const data = await res.json();
      setEncounters(data.encounters);
    };
    fetch_();
    const interval = setInterval(fetch_, 3000);
    return () => clearInterval(interval);
  }, []);

  const active = encounters.filter((e) => !["committed", "rejected"].includes(e.status));

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Field Operations</h2>
          <p className="text-sm text-gray-500">Paramedic dispatch tracking and field data monitoring</p>
        </div>
        <Link
          href="/paramedic"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Open Field Interface
        </Link>
      </div>

      {/* Active Field Units */}
      <div className="bg-white rounded-xl shadow-sm border mb-6">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Active Field Units</h3>
        </div>
        <div className="divide-y">
          {active.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400">No active field operations</div>
          ) : (
            active.map((enc) => (
              <div key={enc.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                    {enc.paramedicName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{enc.paramedicName}</p>
                    <p className="text-xs text-gray-500">
                      {enc.structuredData?.chiefComplaint ?? "Processing..."} | {enc.patientContext?.name ?? "Unknown Patient"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AcuityBadge acuity={enc.acuity} />
                  <StatusBadge status={enc.status} />
                  <span className="text-xs text-gray-400">{new Date(enc.createdAt).toLocaleTimeString()}</span>
                  <Link
                    href="/crm"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Field Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Transcript Volume</h4>
          <p className="text-3xl font-bold text-gray-900">{encounters.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total transcripts received</p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full">
            <div
              className="h-2 bg-blue-500 rounded-full"
              style={{ width: `${Math.min(100, encounters.length * 10)}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Safety Flags</h4>
          <p className="text-3xl font-bold text-red-600">
            {encounters.reduce((sum, e) => sum + (e.safetyFlags?.length ?? 0), 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Drug interactions detected</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Avg Pipeline Agents</h4>
          <p className="text-3xl font-bold text-emerald-600">
            {encounters.length > 0
              ? Math.round(encounters.reduce((sum, e) => sum + e.auditTrail.length, 0) / encounters.length)
              : 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Agents per encounter</p>
        </div>
      </div>
    </div>
  );
}
