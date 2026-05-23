"use client";

import { Encounter } from "@/types";
import { StatusBadge, AcuityBadge } from "@/components/ui/StatusBadge";

interface EncounterCardProps {
  encounter: Encounter;
  onSelect: (encounter: Encounter) => void;
  isSelected: boolean;
}

export function EncounterCard({ encounter, onSelect, isSelected }: EncounterCardProps) {
  const hasConflicts = (encounter.safetyFlags?.length ?? 0) > 0;
  const needsApproval = encounter.status === "needs_doctor_approval";

  return (
    <button
      onClick={() => onSelect(encounter)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        needsApproval
          ? "border-red-300 bg-red-50 animate-pulse hover:animate-none"
          : isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">
              {encounter.patientContext?.name ?? "Unknown Patient"}
            </h3>
            <AcuityBadge acuity={encounter.acuity} />
          </div>
          <p className="text-sm text-gray-600">
            {encounter.structuredData?.chiefComplaint ?? "Processing..."}
          </p>
          <p className="text-xs text-gray-400">
            Paramedic: {encounter.paramedicName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={encounter.status} />
          {hasConflicts && (
            <span className="text-xs font-bold text-red-600">
              {encounter.safetyFlags!.length} SAFETY FLAG{encounter.safetyFlags!.length > 1 ? "S" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
        <span>{new Date(encounter.createdAt).toLocaleTimeString()}</span>
        <span>{encounter.draftOrders?.length ?? 0} orders</span>
        <span>{encounter.auditTrail.length} audit entries</span>
      </div>
    </button>
  );
}
