"use client";

import { Encounter } from "@/types";
import { StatusBadge, AcuityBadge } from "@/components/ui/StatusBadge";
import { AgentTimeline } from "@/components/ui/AgentTimeline";
import { useState } from "react";

interface EncounterDetailProps {
  encounter: Encounter;
  onApprove: (encounterId: string) => void;
  isApproving: boolean;
}

export function EncounterDetail({ encounter, onApprove, isApproving }: EncounterDetailProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "audit">("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {encounter.patientContext?.name ?? "Unknown Patient"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {encounter.patientContext?.age}yo {encounter.patientContext?.sex} | ID: {encounter.patientContext?.patientId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AcuityBadge acuity={encounter.acuity} />
          <StatusBadge status={encounter.status} />
        </div>
      </div>

      {/* Safety Alert Banner */}
      {encounter.safetyFlags && encounter.safetyFlags.length > 0 && (
        <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <h3 className="font-bold text-red-800">SAFETY ALERTS - Apify Drug Interaction Check</h3>
          </div>
          {encounter.safetyFlags.map((flag, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="text-sm font-semibold text-red-700">
                {flag.severity.toUpperCase()}: {flag.drug} conflicts with {flag.conflictsWith}
              </p>
              <p className="text-xs text-red-600 mt-0.5">{flag.description}</p>
              {flag.alternative && (
                <p className="text-xs text-emerald-700 font-medium mt-0.5">
                  Recommended Alternative: {flag.alternative}
                </p>
              )}
            </div>
          ))}
          {encounter.safetyRecommendation && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <p className="text-sm font-medium text-red-800">{encounter.safetyRecommendation}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {(["overview", "orders", "audit"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
              {tab === "orders" && encounter.draftOrders && (
                <span className="ml-1 text-xs bg-gray-100 rounded-full px-2 py-0.5">
                  {encounter.draftOrders.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vitals */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Vitals</h3>
            {(() => {
              const vit = encounter.structuredData?.vitals;
              const rows = [
                { label: "Heart Rate",    value: vit?.heartRate,       unit: "bpm"  },
                { label: "Blood Pressure",value: vit?.bloodPressure,   unit: "mmHg" },
                { label: "SpO2",          value: vit?.spO2,            unit: "%"    },
                { label: "Temperature",   value: vit?.temperature,     unit: "°F"   },
                { label: "Resp. Rate",    value: vit?.respiratoryRate, unit: "/min" },
                { label: "GCS",           value: vit?.gcs,             unit: "/15"  },
              ].filter(r => r.value != null && r.value !== "");
              return rows.length > 0 ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {rows.map(({ label, value, unit }) => (
                    <>
                      <dt key={label + "dt"} className="text-gray-500">{label}</dt>
                      <dd key={label + "dd"} className="font-mono font-medium">{String(value)} {unit}</dd>
                    </>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-gray-400">Awaiting nurse vitals…</p>
              );
            })()}
          </div>

          {/* Diagnosis */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">AI Diagnosis</h3>
            {encounter.diagnosis ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-900">{encounter.diagnosis.primary}</p>
                <p className="text-xs text-gray-500">ICD-10: {encounter.diagnosis.icdCode}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${encounter.diagnosis.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    {(encounter.diagnosis.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">{encounter.diagnosis.reasoning}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Pending...</p>
            )}
          </div>

          {/* Patient Context */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Patient History</h3>
            {encounter.patientContext ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Allergies: </span>
                  <span className="font-medium text-red-600">{encounter.patientContext.allergies.join(", ") || "None"}</span>
                </div>
                <div>
                  <span className="text-gray-500">Current Meds: </span>
                  <span className="font-medium">{encounter.patientContext.currentMedications.join(", ")}</span>
                </div>
                <div>
                  <span className="text-gray-500">Conditions: </span>
                  <span className="font-medium">{encounter.patientContext.conditions.join(", ")}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Loading...</p>
            )}
          </div>

          {/* Field Notes */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Field Transcript</h3>
            <p className="text-sm text-gray-700 font-mono">{encounter.rawTranscript}</p>
            <p className="text-xs text-gray-400 mt-2">Captured by: {encounter.paramedicName}</p>
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-3">
          {encounter.draftOrders?.map((order) => (
            <div
              key={order.id}
              className={`p-4 rounded-lg border-2 ${
                order.status === "blocked"
                  ? "border-red-300 bg-red-50"
                  : order.status === "approved"
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                      order.type === "medication" ? "bg-purple-100 text-purple-700" :
                      order.type === "imaging" ? "bg-blue-100 text-blue-700" :
                      order.type === "procedure" ? "bg-amber-100 text-amber-700" :
                      order.type === "lab" ? "bg-cyan-100 text-cyan-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {order.type}
                    </span>
                    <span className={`text-xs font-bold uppercase ${
                      order.urgency === "stat" ? "text-red-600" : "text-gray-500"
                    }`}>
                      {order.urgency}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 mt-1">{order.description}</p>
                  {order.medication && (
                    <p className="text-xs text-gray-500 mt-0.5">{order.medication.dosage} | {order.medication.route}</p>
                  )}
                </div>
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                  order.status === "blocked" ? "bg-red-200 text-red-800" :
                  order.status === "approved" ? "bg-green-200 text-green-800" :
                  "bg-gray-200 text-gray-800"
                }`}>
                  {order.status}
                </span>
              </div>
              {order.safetyNotes && (
                <p className="mt-2 text-xs text-red-600 font-medium">{order.safetyNotes}</p>
              )}
              {order.alternative && order.status === "blocked" && (
                <p className="mt-1 text-xs text-emerald-600 font-medium">Alternative: {order.alternative}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "audit" && (
        <AgentTimeline entries={encounter.auditTrail} />
      )}

      {/* Action Buttons */}
      {(encounter.status === "needs_doctor_approval" || encounter.status === "order_drafted" || encounter.status === "safety_flagged") && (
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => onApprove(encounter.id)}
            disabled={isApproving}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isApproving ? "Processing..." : "Approve & Commit to EHR"}
          </button>
        </div>
      )}

      {encounter.status === "committed" && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-800 font-bold">Committed to EHR</p>
          <p className="text-sm text-green-600 mt-1">
            Approved by {encounter.physicianName} at {encounter.approvedAt ? new Date(encounter.approvedAt).toLocaleString() : ""}
          </p>
          <p className="text-xs text-green-500 mt-1">
            Audit checksum: {encounter.auditTrail[encounter.auditTrail.length - 1]?.checksum?.substring(0, 16)}...
          </p>
        </div>
      )}
    </div>
  );
}
