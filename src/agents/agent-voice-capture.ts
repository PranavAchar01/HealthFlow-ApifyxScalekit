import { AgentResult } from "@/types";
import { createAuditEntry } from "@/lib/audit";

/**
 * Agent 1 — Voice Capture
 *
 * Binds the field transcript to the authenticated paramedic's identity and
 * creates the first checksum entry proving who provided the raw data.
 * (Transcription itself happens client-side via ElevenLabs Scribe before this.)
 */
export function agentVoiceCapture(
  rawText: string,
  paramedicId: string,
  paramedicName: string
): AgentResult<{ rawTranscript: string }> {
  const start = Date.now();
  const audit = createAuditEntry(
    "voice_capture",
    "TRANSCRIBE",
    `Paramedic ${paramedicName} (${paramedicId}) captured field transcript: ${rawText.substring(0, 100)}...`,
    paramedicId,
    paramedicName
  );
  return {
    agentRole: "voice_capture",
    success: true,
    data: { rawTranscript: rawText },
    processingTimeMs: Date.now() - start,
    auditEntry: audit,
  };
}
