"use client";
import type { EncounterStatus, AcuityLevel } from "@/types";

const ACUITY_STYLE: Record<AcuityLevel, string> = {
  critical: "bg-red-100 text-red-800 font-bold",
  high: "bg-orange-100 text-orange-800 font-bold",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

const STATUS_LABEL: Partial<Record<EncounterStatus, string>> = {
  field_capture: "Field Capture",
  structuring: "Processing",
  context_loaded: "Context Loaded",
  diagnosis_complete: "Diagnosed",
  order_drafted: "Orders Ready",
  safety_flagged: "Safety Flagged",
  needs_doctor_approval: "Needs Doctor",
  approved: "Approved",
  committed: "Committed",
  rejected: "Rejected",
};

export function AcuityPill({ acuity }: { acuity: AcuityLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs uppercase ${ACUITY_STYLE[acuity]}`}>
      {acuity === "critical" && <span className="animate-pulse">●</span>}
      {acuity}
    </span>
  );
}

export function StatusPill({ status }: { status: EncounterStatus }) {
  const isBad = status === "needs_doctor_approval" || status === "safety_flagged";
  const isGood = status === "committed" || status === "approved";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      isBad ? "bg-red-100 text-red-700" : isGood ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
    }`}>
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

const TRIAGE_STYLE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_assessment: "bg-blue-100 text-blue-700",
  ready_for_doctor: "bg-emerald-100 text-emerald-700",
  escalated: "bg-red-100 text-red-700 font-bold",
};

export function TriagePill({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-gray-400 italic">No triage</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${TRIAGE_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
