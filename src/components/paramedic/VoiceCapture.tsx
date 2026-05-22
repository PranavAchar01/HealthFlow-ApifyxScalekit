"use client";

import { useState, useRef, useCallback } from "react";

interface VoiceCaptureProps {
  onTranscriptSubmit: (transcript: string) => void;
  isProcessing: boolean;
}

export function VoiceCapture({ onTranscriptSubmit, isProcessing }: VoiceCaptureProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch {
      setTranscript((prev) => prev || "Microphone access denied. Please type your observations below.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");

      setTranscript((prev) => {
        const separator = prev.trim() ? " " : "";
        return prev + separator + data.text;
      });
    } catch (err) {
      setTranscript((prev) => prev || `Transcription error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = () => {
    if (transcript.trim()) {
      onTranscriptSubmit(transcript.trim());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing || isTranscribing}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition-all ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : "bg-blue-600 hover:bg-blue-700"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRecording ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
              Stop Recording
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Start Dictation
            </>
          )}
        </button>

        {isTranscribing && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Transcribing with ElevenLabs...
          </div>
        )}

        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
          Powered by ElevenLabs Scribe
        </span>
      </div>

      <div className="relative">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={"Dictate or type patient vitals and observations...\n\nExample: 68 year old male, suspected stroke, left-side paralysis, onset 20 minutes ago. Heart rate 92, blood pressure 168/94, SpO2 96%, GCS 13. Patient is alert but confused with facial droop and slurred speech."}
          rows={8}
          className="w-full rounded-lg border-2 border-gray-200 p-4 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors resize-none"
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
        <p className="text-xs text-gray-400">
          {transcript.split(/\s+/).filter(Boolean).length} words captured
        </p>
        <button
          onClick={handleSubmit}
          disabled={!transcript.trim() || isProcessing || isTranscribing}
          className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            "Submit to Agent Pipeline"
          )}
        </button>
      </div>
    </div>
  );
}
