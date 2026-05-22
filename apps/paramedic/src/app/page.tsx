"use client";

import { useState, useRef, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PARAMEDIC_TOKEN = "paramedic_sarah";

type PipelineResult = {
  status: string;
  acuity: string;
  chiefComplaint?: string;
  diagnosis?: string;
  confidence?: number;
  safetyFlags: number;
  orders: number;
  encounterId: string;
  doctorCrmUrl?: string;
};

export default function ParamedicApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "recording.webm");

          const res = await fetch(`${API_URL}/api/voice/transcribe`, { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setTranscript((prev) => (prev ? prev + " " + data.text : data.text));
        } catch (err) {
          setError(`Transcription failed: ${err instanceof Error ? err.message : "unknown"}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mr.start(250);
      setIsRecording(true);
    } catch {
      setError("Microphone access denied. Please type your observations.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleSubmit = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/agents/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PARAMEDIC_TOKEN}` },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const enc = data.encounter;

      setResult({
        encounterId: enc.id,
        status: enc.status,
        acuity: enc.acuity,
        chiefComplaint: enc.structuredData?.chiefComplaint,
        diagnosis: enc.diagnosis?.primary,
        confidence: enc.diagnosis?.confidence,
        safetyFlags: enc.safetyFlags?.length ?? 0,
        orders: enc.draftOrders?.length ?? 0,
        doctorCrmUrl: process.env.NEXT_PUBLIC_DOCTOR_CRM_URL,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold">GF</div>
            <div>
              <p className="text-white font-bold text-sm">GuestFlow Field</p>
              <p className="text-blue-300 text-xs">Paramedic Voice Interface</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white text-sm font-medium">Sarah Mitchell</p>
              <p className="text-blue-300 text-xs">Paramedic · Unit 42</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">SM</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Voice Capture Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">🎙️</div>
            <div>
              <h2 className="font-bold text-gray-900">Voice Capture</h2>
              <p className="text-xs text-gray-500">ElevenLabs Scribe · 9-Agent Pipeline</p>
            </div>
          </div>

          {/* Record button */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing || isTranscribing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm transition-all disabled:opacity-50 ${
                isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isRecording ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                  Stop Recording
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Dictation
                </>
              )}
            </button>
            {isTranscribing && (
              <span className="text-xs text-blue-600 flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Transcribing...
              </span>
            )}
          </div>

          {/* Transcript textarea */}
          <div className="relative mb-4">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={"Dictate or type patient vitals and observations...\n\nExample: 68yo male, suspected stroke, left hemiparesis, onset 20 min ago. HR 92, BP 168/94, SpO2 96%, GCS 13. Facial droop and slurred speech."}
              rows={7}
              className="w-full rounded-lg border-2 border-gray-200 p-3.5 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors resize-none"
            />
            {isRecording && (
              <div className="absolute top-2 right-2">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{wordCount} words</p>
            <button
              onClick={handleSubmit}
              disabled={!transcript.trim() || isProcessing || isTranscribing}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Running Pipeline...
                </span>
              ) : "Submit to Agent Pipeline"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Pipeline Complete</h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
                  result.acuity === "critical" ? "bg-red-100 text-red-700" :
                  result.acuity === "high" ? "bg-orange-100 text-orange-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {result.acuity === "critical" && "● "}
                  {result.acuity}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  {result.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Orders", value: result.orders, color: "text-gray-900" },
                { label: "Safety Flags", value: result.safetyFlags, color: result.safetyFlags > 0 ? "text-red-600" : "text-gray-900" },
                { label: "Dx Confidence", value: result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : "—", color: "text-blue-600" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Diagnosis */}
            {result.diagnosis && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-500 font-medium mb-0.5">AI Diagnosis</p>
                <p className="text-sm font-semibold text-blue-900">{result.diagnosis}</p>
              </div>
            )}

            {/* Safety alert */}
            {result.safetyFlags > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-bold text-red-700">
                  ⚠ {result.safetyFlags} safety flag{result.safetyFlags > 1 ? "s" : ""} detected — orders pending physician review
                </p>
              </div>
            )}

            {/* Handoff */}
            <div className="pt-3 border-t text-center space-y-2">
              <p className="text-xs text-gray-500">Encounter routed to Hospital CRM · ID: {result.encounterId.substring(0, 8)}...</p>
              {result.doctorCrmUrl && (
                <a
                  href={result.doctorCrmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Open Doctor CRM
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            {/* New encounter */}
            <button
              onClick={() => { setTranscript(""); setResult(null); }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              Start New Encounter
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
