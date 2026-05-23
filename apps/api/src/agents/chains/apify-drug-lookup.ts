/**
 * Apify adapter — real FDA drug interaction data via
 * the "azureblue/drug-interaction-checker" actor.
 *
 * Wraps the entire call in try/catch with a 15-second timeout.
 * If the token is missing, the actor times out, or any error occurs,
 * returns { orders, conflicts: [] } so the caller falls back to the
 * hardcoded DRUG_INTERACTIONS table in safety-chain.ts.
 */

import { ApifyClient } from "apify-client";
import { DraftOrder, PatientContext, DrugConflict } from "@/types";

const TIMEOUT_MS = 15_000;

function mapSeverity(actorSeverity: string): DrugConflict["severity"] {
  const s = actorSeverity.toLowerCase();
  if (s === "contraindicated") return "contraindicated";
  if (s === "major") return "critical";
  // "moderate" | "minor" | anything else → warning
  return "warning";
}

export async function apifyDrugInteractionCheck(
  draftOrders: DraftOrder[],
  patientContext: PatientContext
): Promise<{ orders: DraftOrder[]; conflicts: DrugConflict[] }> {
  const token = process.env.APIFY_API_TOKEN;

  if (!token) {
    console.log("[apify-drug] APIFY_API_TOKEN not set — skipping Apify lookup");
    return { orders: draftOrders, conflicts: [] };
  }

  const client = new ApifyClient({ token });
  const conflicts: DrugConflict[] = [];

  // Only check medication orders
  const medOrders = draftOrders.filter((o) => o.medication);

  try {
    await Promise.race([
      (async () => {
        for (const order of medOrders) {
          const orderDrugName = order.medication!.medication;

          for (const currentMed of patientContext.currentMedications) {
            const runInput = {
              drug1: orderDrugName,
              drug2: currentMed,
            };

            console.log(
              `[apify-drug] Checking interaction: "${orderDrugName}" × "${currentMed}"`
            );

            let run;
            try {
              run = await client
                .actor("azureblue/drug-interaction-checker")
                .call(runInput);
            } catch (actorErr) {
              console.warn(
                `[apify-drug] Actor call failed for ${orderDrugName}×${currentMed}:`,
                actorErr
              );
              continue;
            }

            const { items } = await client
              .dataset(run.defaultDatasetId)
              .listItems();

            for (const item of items as Record<string, unknown>[]) {
              const severity = item.severity as string | undefined;
              const description = item.description as string | undefined;

              if (!severity || !description) continue;

              const mappedSeverity = mapSeverity(severity);
              const alternative =
                orderDrugName.toLowerCase().includes("tpa") ||
                orderDrugName.toLowerCase().includes("alteplase")
                  ? "Emergency mechanical thrombectomy"
                  : undefined;

              const conflict: DrugConflict = {
                drug: orderDrugName,
                conflictsWith: currentMed,
                severity: mappedSeverity,
                description,
                ...(alternative ? { alternative } : {}),
              };

              conflicts.push(conflict);
              order.conflicts = [...(order.conflicts ?? []), conflict];

              if (mappedSeverity === "contraindicated") {
                order.status = "blocked";
                order.medication!.status = "blocked";
                order.medication!.contraindication = description;
                order.safetyNotes = `BLOCKED: ${description}`;
                if (alternative) order.alternative = alternative;
              }

              console.log(
                `[apify-drug] Found interaction: ${orderDrugName} × ${currentMed} → ${mappedSeverity}`
              );
            }
          }
        }
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Apify drug lookup timed out")), TIMEOUT_MS)
      ),
    ]);

    console.log(
      `[apify-drug] Complete — ${conflicts.length} conflict(s) found across ${medOrders.length} medication order(s)`
    );
    return { orders: draftOrders, conflicts };
  } catch (err) {
    console.warn("[apify-drug] Lookup failed or timed out, falling back to local table:", err);
    return { orders: draftOrders, conflicts: [] };
  }
}
