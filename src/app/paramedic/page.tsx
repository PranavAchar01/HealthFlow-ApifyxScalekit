"use client";

import { useState } from "react";
import { VoiceCapture } from "@/components/paramedic/VoiceCapture";
import { AgentTimeline } from "@/components/ui/AgentTimeline";
import { StatusBadge, AcuityBadge } from "@/components/ui/StatusBadge";
import { Encounter } from "@/types";
import Link from "next/link";

export default function ParamedicPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (transcript: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/agents/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer paramedic_sarah",
        },
        body: JSON.stringify({ transcript }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEncounter(data.encounter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
              HF
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">HealthFlow Field</h1>
              <p className="text-blue-300 text-xs">Paramedic Interface</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white text-sm font-medium">Sarah Mitchell</p>
              <p className="text-blue-300 text-xs">Paramedic | Unit 42</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
              SM
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Voice Capture Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Voice Capture</h2>
              <p className="text-sm text-gray-500">Agent 1: Dictate patient vitals and observations</p>
            </div>
          </div>
          <VoiceCapture onTranscriptSubmit={handleSubmit} isProcessing={isProcessing} />
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-8">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Pipeline Results */}
        {encounter && (
          <div className="space-y-6">
            {/* Status Overview */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Pipeline Complete</h3>
                <div className="flex items-center gap-2">
                  <AcuityBadge acuity={encounter.acuity} />
                  <StatusBadge status={encounter.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{encounter.auditTrail.length}</p>
                  <p className="text-xs text-gray-500">Agents Run</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{encounter.draftOrders?.length ?? 0}</p>
                  <p className="text-xs text-gray-500">Orders Drafted</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{encounter.safetyFlags?.length ?? 0}</p>
                  <p className="text-xs text-gray-500">Safety Flags</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {encounter.diagnosis ? `${(encounter.diagnosis.confidence * 100).toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-xs text-gray-500">Dx Confidence</p>
                </div>
              </div>

              {/* Diagnosis */}
              {encounter.diagnosis && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-blue-900">AI Diagnosis: {encounter.diagnosis.primary}</p>
                  <p className="text-xs text-blue-700 mt-1">{encounter.diagnosis.reasoning}</p>
                </div>
              )}

              {/* Safety Alert */}
              {encounter.safetyFlags && encounter.safetyFlags.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                  <p className="font-bold text-red-800 mb-2">Safety Alerts (Apify Drug Check)</p>
                  {encounter.safetyFlags.map((flag, i) => (
                    <div key={i} className="text-sm text-red-700 mb-1">
                      <span className="font-semibold">{flag.severity.toUpperCase()}:</span> {flag.drug} / {flag.conflictsWith} — {flag.description}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-500 mb-3">
                  Encounter routed to Hospital CRM for physician review
                </p>
                <Link
                  href="/crm"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Open CRM Dashboard
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Agent Timeline */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Agent Pipeline Timeline</h3>
              <AgentTimeline entries={encounter.auditTrail} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
