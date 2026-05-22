"use client";

import { EncounterStatus, AcuityLevel } from "@/types";

const STATUS_STYLES: Record<EncounterStatus, { bg: string; text: string; label: string }> = {
  field_capture: { bg: "bg-blue-100", text: "text-blue-800", label: "Field Capture" },
  structuring: { bg: "bg-indigo-100", text: "text-indigo-800", label: "Structuring" },
  context_loaded: { bg: "bg-purple-100", text: "text-purple-800", label: "Context Loaded" },
  diagnosis_complete: { bg: "bg-violet-100", text: "text-violet-800", label: "Diagnosed" },
  order_drafted: { bg: "bg-amber-100", text: "text-amber-800", label: "Orders Drafted" },
  safety_flagged: { bg: "bg-orange-100", text: "text-orange-800", label: "Safety Flagged" },
  needs_doctor_approval: { bg: "bg-red-100", text: "text-red-800", label: "Needs Approval" },
  approved: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Approved" },
  committed: { bg: "bg-green-100", text: "text-green-800", label: "Committed to EHR" },
  rejected: { bg: "bg-gray-100", text: "text-gray-800", label: "Rejected" },
};

const ACUITY_STYLES: Record<AcuityLevel, { bg: string; text: string }> = {
  low: { bg: "bg-green-100", text: "text-green-800" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-800" },
  high: { bg: "bg-orange-100", text: "text-orange-800" },
  critical: { bg: "bg-red-100", text: "text-red-800" },
};

export function StatusBadge({ status }: { status: EncounterStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function AcuityBadge({ acuity }: { acuity: AcuityLevel }) {
  const style = ACUITY_STYLES[acuity];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${style.bg} ${style.text}`}>
      {acuity === "critical" && <span className="mr-1 animate-pulse">●</span>}
      {acuity}
    </span>
  );
}
