import { DraftOrder, PatientContext, DrugConflict } from "@/types";
import { v4 as uuidv4 } from "uuid";

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

export function runDrugAllergyCheck(
  orders: DraftOrder[],
  patientContext: PatientContext
): { orders: DraftOrder[]; conflicts: DrugConflict[] } {
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

  return { orders, conflicts };
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
