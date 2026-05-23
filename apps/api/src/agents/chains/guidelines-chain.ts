/**
 * Guidelines chain — fetches clinical treatment guidelines for a diagnosed condition.
 *
 * Priority:
 * 1. Apify web-scraper → real AHA/ACC/ASA guideline content
 * 2. Hardcoded fallback guidelines (always works, no external deps)
 */

import { Encounter, GuidelineResult } from "@/types";
import { apifyGuidelinesLookup } from "./apify-guidelines-lookup";

// ---------------------------------------------------------------------------
// Hardcoded fallback guidelines
// ---------------------------------------------------------------------------

const FALLBACK_GUIDELINES: Record<string, GuidelineResult> = {
  stroke: {
    condition: "Acute Ischemic Stroke",
    source: "AHA/ASA Ischemic Stroke Guidelines 2019 (built-in)",
    recommendations: [
      {
        text: "IV alteplase (tPA) within 3–4.5 hours of symptom onset if no contraindications (Class I, Level A)",
        class: "I",
        evidenceLevel: "A",
      },
      {
        text: "Mechanical thrombectomy for large vessel occlusion within 6–24 hours of last known well (Class I, Level A)",
        class: "I",
        evidenceLevel: "A",
      },
      {
        text: "Aspirin 325 mg within 24–48 hours of onset (do NOT give if tPA administered within last 24 hours) (Class I, Level A)",
        class: "I",
        evidenceLevel: "A",
      },
      {
        text: "Blood pressure < 185/110 mmHg required before tPA; maintain < 180/105 mmHg for 24 h after tPA (Class I, Level B)",
        class: "I",
        evidenceLevel: "B",
      },
    ],
    timeWindow: "3–4.5 hours for tPA; up to 24 hours for thrombectomy",
    redFlags: ["hemorrhage", "anticoagulation", "INR > 1.7", "recent surgery"],
    summary:
      "IV tPA is the primary reperfusion therapy for ischemic stroke if given within the time window and no contraindications exist.",
  },
  stemi: {
    condition: "ST-Elevation Myocardial Infarction",
    source: "ACC/AHA STEMI Guidelines 2013/2015 Update (built-in)",
    recommendations: [
      {
        text: "Primary PCI is the preferred reperfusion strategy when available within 90 minutes of first medical contact (Class I, Level A)",
        class: "I",
        evidenceLevel: "A",
      },
      {
        text: "Aspirin 325 mg loading dose immediately, then 81 mg daily (Class I, Level A)",
        class: "I",
        evidenceLevel: "A",
      },
      {
        text: "P2Y12 inhibitor (ticagrelor or clopidogrel) in addition to aspirin (Class I, Level B)",
        class: "I",
        evidenceLevel: "B",
      },
      {
        text: "Anticoagulation with UFH or bivalirudin at time of PCI (Class I, Level B)",
        class: "I",
        evidenceLevel: "B",
      },
      {
        text: "Fibrinolytic therapy if PCI not available within 120 minutes and no contraindications (Class I, Level A)",
        class: "I",
        evidenceLevel: "A",
      },
    ],
    timeWindow: "Door-to-balloon time < 90 minutes for primary PCI",
    redFlags: ["active bleeding", "prior intracranial hemorrhage", "aortic dissection"],
    summary:
      "Primary PCI is the gold standard for STEMI. Aspirin + P2Y12 inhibitor dual antiplatelet therapy initiated immediately.",
  },
  default: {
    condition: "General Emergency",
    source: "Built-in clinical guidance",
    recommendations: [
      {
        text: "Ensure airway, breathing, circulation (ABCs) — primary survey",
      },
      { text: "Establish IV access; obtain 12-lead ECG and full vitals" },
      { text: "Draw baseline labs: CBC, BMP, coagulation panel, troponin" },
      { text: "Monitor SpO2; supplemental O2 if SpO2 < 94%" },
    ],
    summary: "Standard emergency evaluation and stabilization protocol.",
  },
};

function selectFallback(condition: string): GuidelineResult {
  const c = condition.toLowerCase();
  if (c.includes("stroke") || c.includes("ischemic")) return FALLBACK_GUIDELINES.stroke;
  if (c.includes("stemi") || c.includes("myocardial") || c.includes("infarction"))
    return FALLBACK_GUIDELINES.stemi;
  return FALLBACK_GUIDELINES.default;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runGuidelinesChain(
  encounter: Encounter
): Promise<{ guideline: GuidelineResult; usedApify: boolean }> {
  if (!encounter.diagnosis) {
    return { guideline: FALLBACK_GUIDELINES.default, usedApify: false };
  }

  // 1. Try Apify first
  const apifyResult = await apifyGuidelinesLookup(encounter.diagnosis);
  if (apifyResult) {
    return { guideline: apifyResult, usedApify: true };
  }

  // 2. Fall back to hardcoded table
  const fallback = selectFallback(encounter.diagnosis.primary);
  return { guideline: fallback, usedApify: false };
}
