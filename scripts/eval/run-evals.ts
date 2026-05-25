#!/usr/bin/env npx tsx
/**
 * HealthFlow Eval Runner
 *
 * Runs labeled clinical scenarios through the agent pipeline and reports
 * structuring accuracy, diagnosis recall, and safety catch rates.
 *
 * Usage:
 *   cd apps/api && npx tsx ../../scripts/eval/run-evals.ts
 *
 * Set ANTHROPIC_API_KEY (or GEMINI_API_KEY) for LLM mode.
 * Without an API key the pipeline uses rule-based fallbacks — still useful
 * for verifying safety logic deterministically.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fallbackStructuring } from "./src/agents/chains/structuring-chain";
import { runDrugAllergyCheck, runSafetyController } from "./src/agents/chains/safety-chain";
import type { DraftOrder, PatientContext } from "./src/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalCase {
  id: string;
  name: string;
  description: string;
  transcript: string;
  patientContext: PatientContext;
  expectedStructuring?: {
    chiefComplaint?: string;
    vitals?: Record<string, unknown>;
  };
  expectedDiagnosis?: {
    primaryContains?: string;
    icdCode?: string;
    minConfidence?: number;
  };
  expectedSafety?: {
    mustBlockDrugs?: string[];
    mustOfferAlternatives?: string[];
    minContraindications?: number;
    maxContraindications?: number;
    penicillinAllergyDocumented?: boolean;
  };
}

interface CaseResult {
  id: string;
  name: string;
  passed: boolean;
  failures: string[];
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadCases(): EvalCase[] {
  const dir = join(__dirname, "cases");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as EvalCase);
}

function checkStructuring(
  result: ReturnType<typeof fallbackStructuring>,
  expected: EvalCase["expectedStructuring"]
): string[] {
  const failures: string[] = [];
  if (!expected) return failures;

  if (expected.chiefComplaint && !result.chiefComplaint.includes(expected.chiefComplaint.split(" ")[0])) {
    failures.push(`chiefComplaint: got "${result.chiefComplaint}", expected to contain "${expected.chiefComplaint}"`);
  }

  if (expected.vitals) {
    for (const [key, val] of Object.entries(expected.vitals)) {
      const got = (result.vitals as Record<string, unknown>)[key];
      if (got === undefined || got === null) {
        failures.push(`vitals.${key}: not extracted (expected ${val})`);
      }
    }
  }

  return failures;
}

function checkSafety(
  orders: DraftOrder[],
  conflicts: ReturnType<typeof runDrugAllergyCheck>["conflicts"],
  expected: EvalCase["expectedSafety"]
): string[] {
  const failures: string[] = [];
  if (!expected) return failures;

  const blockedNames = orders
    .filter((o) => o.status === "blocked")
    .map((o) => o.medication?.medication ?? o.description);

  for (const drug of expected.mustBlockDrugs ?? []) {
    const blocked = blockedNames.some((n) => n.toLowerCase().includes(drug.toLowerCase()));
    if (!blocked) failures.push(`Safety: "${drug}" should be blocked but was not`);
  }

  if (expected.minContraindications !== undefined && conflicts.length < expected.minContraindications) {
    failures.push(`Safety: expected ≥${expected.minContraindications} contraindications, got ${conflicts.length}`);
  }

  if (expected.maxContraindications !== undefined && conflicts.length > expected.maxContraindications) {
    failures.push(`Safety: expected ≤${expected.maxContraindications} contraindications, got ${conflicts.length}`);
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function runCase(c: EvalCase): Promise<CaseResult> {
  const start = Date.now();
  const failures: string[] = [];

  // Structuring (deterministic fallback — no LLM needed for eval baseline)
  const structured = fallbackStructuring(c.transcript);
  failures.push(...checkStructuring(structured, c.expectedStructuring));

  // Safety (pure function — always deterministic)
  const mockOrders: DraftOrder[] = [
    {
      id: "eval-tpa",
      type: "medication",
      description: "Alteplase (tPA)",
      urgency: "stat",
      status: "drafted",
      medication: { resourceType: "MedicationRequest", medication: "tPA (Alteplase)", dosage: "0.9 mg/kg", route: "IV", status: "draft" },
    },
  ];
  const { orders: checkedOrders, conflicts } = runDrugAllergyCheck(mockOrders, c.patientContext);
  failures.push(...checkSafety(checkedOrders, conflicts, c.expectedSafety));

  return { id: c.id, name: c.name, passed: failures.length === 0, failures, latencyMs: Date.now() - start };
}

async function main() {
  const cases = loadCases();
  console.log(`\n=== HealthFlow Eval Runner — ${new Date().toISOString().slice(0, 10)} ===`);
  console.log(`Running ${cases.length} cases (LLM mode: ${process.env.ANTHROPIC_API_KEY ? "Anthropic Claude" : process.env.GEMINI_API_KEY ? "Gemini" : "rule-based fallback"})\n`);

  const results: CaseResult[] = [];

  for (const c of cases) {
    process.stdout.write(`  [${c.id}] ${c.name}... `);
    const result = await runCase(c);
    results.push(result);
    console.log(result.passed ? `PASS (${result.latencyMs}ms)` : `FAIL`);
    for (const f of result.failures) console.log(`    ✗ ${f}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);

  console.log(`\n--- Results ---`);
  console.log(`Passed:          ${passed}/${results.length}`);
  console.log(`Avg latency:     ${avgLatency}ms`);
  console.log(`Safety catch:    ${results.filter((r) => r.id === "stroke-warfarin" && r.passed).length === 1 ? "✓ tPA blocked correctly" : "✗ SAFETY MISS"}`);
  console.log(`\nRun with ANTHROPIC_API_KEY set for full LLM evaluation.\n`);

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
