import { DraftOrder, PatientContext, DrugConflict } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { apifyDrugInteractionCheck } from "./apify-drug-lookup";

const DRUG_INTERACTIONS: DrugConflict[] = [
  {
    drug: "tPA",
    conflictsWith: "Warfarin",
    severity: "contraindicated",
    description: "Administering tPA to a patient on Warfarin (INR 2.8) carries extreme risk of fatal intracranial hemorrhage. The anticoagulated state dramatically increases bleeding complications.",
    alternative: "Emergency mechanical thrombectomy",
  },
  {
    drug: "Aspirin",
    conflictsWith: "Warfarin",
    severity: "critical",
    description: "Dual anticoagulation/antiplatelet therapy significantly increases bleeding risk.",
    alternative: "Consult hematology before combining",
  },
  {
    drug: "Ibuprofen",
    conflictsWith: "Warfarin",
    severity: "warning",
    description: "NSAIDs may increase INR and bleeding risk with Warfarin.",
    alternative: "Acetaminophen for pain management",
  },
];

export async function runDrugAllergyCheck(
  orders: DraftOrder[],
  patientContext: PatientContext
): Promise<{ orders: DraftOrder[]; conflicts: DrugConflict[]; auditNote: string }> {
  // ── 1. Try Apify FDA drug interaction checker ──────────────────────────────
  const apifyResult = await apifyDrugInteractionCheck(orders, patientContext);

  if (apifyResult.conflicts.length > 0) {
    // Apify found real interactions — also run allergy check (local, instant)
    runAllergyCheck(apifyResult.orders, patientContext, apifyResult.conflicts);
    const pairs = apifyResult.conflicts
      .map((c) => `${c.drug} + ${c.conflictsWith}`)
      .join(", ");
    const auditNote = `Apify FDA drug interaction check: queried ${pairs}, found ${apifyResult.conflicts.length} interaction(s) via azureblue/drug-interaction-checker`;
    return { orders: apifyResult.orders, conflicts: apifyResult.conflicts, auditNote };
  }

  // ── 2. Apify unavailable or returned no conflicts — use hardcoded table ────
  const conflicts: DrugConflict[] = [];

  for (const order of orders) {
    if (!order.medication) continue;

    for (const interaction of DRUG_INTERACTIONS) {
      const orderDrug = order.medication.medication.toLowerCase();
      const currentMeds = patientContext.currentMedications.map((m) => m.toLowerCase());

      if (
        orderDrug.includes(interaction.drug.toLowerCase()) &&
        currentMeds.some((m) => m.includes(interaction.conflictsWith.toLowerCase()))
      ) {
        conflicts.push(interaction);
        order.conflicts = [...(order.conflicts ?? []), interaction];

        if (interaction.severity === "contraindicated") {
          order.status = "blocked";
          order.medication.status = "blocked";
          order.medication.contraindication = interaction.description;
          order.safetyNotes = `BLOCKED: ${interaction.description}`;
          order.alternative = interaction.alternative;
        }
      }
    }
  }

  runAllergyCheck(orders, patientContext, conflicts);

  const auditNote = `Drug interaction check: Apify unavailable, using local interaction database (${DRUG_INTERACTIONS.length} known interactions)`;
  return { orders, conflicts, auditNote };
}

/** Allergy check — always runs locally regardless of Apify result. */
function runAllergyCheck(
  orders: DraftOrder[],
  patientContext: PatientContext,
  conflicts: DrugConflict[]
): void {
  for (const order of orders) {
    if (!order.medication) continue;
    for (const allergy of patientContext.allergies) {
      if (order.medication.medication.toLowerCase().includes(allergy.toLowerCase())) {
        const allergyConflict: DrugConflict = {
          drug: order.medication.medication,
          conflictsWith: `Patient Allergy: ${allergy}`,
          severity: "contraindicated",
          description: `Patient has documented allergy to ${allergy}`,
        };
        conflicts.push(allergyConflict);
        order.status = "blocked";
        order.medication.status = "blocked";
      }
    }
  }
}

export function runSafetyController(
  orders: DraftOrder[],
  conflicts: DrugConflict[]
): { orders: DraftOrder[]; recommendation: string } {
  const hasContraindicated = conflicts.some((c) => c.severity === "contraindicated");

  let recommendation: string;

  if (hasContraindicated) {
    const blocked = orders.filter((o) => o.status === "blocked");
    const alternatives = blocked
      .filter((o) => o.alternative)
      .map((o) => o.alternative)
      .join("; ");

    recommendation = `SAFETY HOLD: ${blocked.length} order(s) blocked due to contraindications. Recommended alternatives: ${alternatives || "Consult specialist"}. Requires physician review.`;

    for (const order of orders) {
      if (order.status === "blocked" && order.alternative) {
        orders.push({
          id: uuidv4(),
          type: "procedure",
          description: order.alternative,
          urgency: "stat",
          status: "drafted",
          safetyNotes: `Alternative to blocked ${order.description}`,
        });
      }
    }
  } else if (conflicts.length > 0) {
    recommendation = `WARNING: ${conflicts.length} drug interaction(s) flagged. Review recommended before execution.`;
  } else {
    recommendation = "All orders cleared safety checks. Ready for physician approval.";
  }

  return { orders, recommendation };
}
