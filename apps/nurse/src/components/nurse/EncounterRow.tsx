"use client";
import type { Encounter } from "@/types";
import { AcuityPill, StatusPill, TriagePill } from "@/components/ui/badges";

interface Props {
  encounter: Encounter;
  isSelected: boolean;
  onSelect: (e: Encounter) => void;
}

export function EncounterRow({ encounter, isSelected, onSelect }: Props) {
  const hasFlags = (encounter.safetyFlags?.length ?? 0) > 0;
  const isUrgent = encounter.acuity === "critical" || encounter.acuity === "high";

  return (
    <button
      onClick={() => onSelect(encounter)}
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        isSelected
          ? "bg-teal-50 border-l-4 border-l-teal-500"
          : isUrgent
          ? "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-400"
          : "bg-white hover:bg-gray-50 border-l-4 border-l-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">
            {encounter.patientContext?.name ?? "Unknown Patient"}
          </p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {encounter.structuredData?.chiefComplaint ?? "Processing..."}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            via {encounter.paramedicName} · {new Date(encounter.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <AcuityPill acuity={encounter.acuity} />
          <TriagePill status={encounter.triageStatus} />
        </div>
      </div>
      {hasFlags && (
        <p className="mt-1.5 text-xs font-bold text-red-600">
          ⚠ {encounter.safetyFlags!.length} safety flag{encounter.safetyFlags!.length > 1 ? "s" : ""}
        </p>
      )}
    </button>
  );
}
