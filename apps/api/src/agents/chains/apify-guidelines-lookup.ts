/**
 * Apify adapter — scrapes real clinical guidelines via
 * the "apify/web-scraper" actor targeting condition-specific
 * AHA/ACC/ASA guideline search results.
 *
 * Wraps everything in try/catch with a 20-second timeout.
 * Returns null on any failure so the caller falls back to
 * hardcoded guidelines in guidelines-chain.ts.
 */

import { ApifyClient } from "apify-client";
import { DiagnosisResult, GuidelineResult } from "@/types";

const TIMEOUT_MS = 20_000;

function buildSearchUrl(diagnosis: DiagnosisResult): string {
  const primary = diagnosis.primary.toLowerCase();

  if (primary.includes("stroke") || primary.includes("ischemic")) {
    return "https://www.google.com/search?q=AHA+ASA+acute+ischemic+stroke+guidelines+treatment+recommendations";
  }
  if (
    primary.includes("mi") ||
    primary.includes("myocardial") ||
    primary.includes("stemi") ||
    primary.includes("infarction")
  ) {
    return "https://www.google.com/search?q=ACC+AHA+STEMI+guidelines+treatment+recommendations";
  }
  // Generic fallback
  const encoded = encodeURIComponent(
    `${diagnosis.primary} clinical treatment guidelines recommendations`
  );
  return `https://www.google.com/search?q=${encoded}`;
}

function parseScrapedText(
  text: string,
  diagnosis: DiagnosisResult
): GuidelineResult {
  // Extract lines that look like guideline recommendations
  const lines = text
    .split(/[\n.]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 40 && l.length < 400);

  const recommendations = lines.slice(0, 5).map((line) => ({
    text: line,
    class: undefined as string | undefined,
    evidenceLevel: undefined as string | undefined,
  }));

  // Look for time window mentions
  const timeWindowMatch = text.match(/(\d+[\s-]*(?:hour|minute|min|hr)[s]?[\s\w]*window)/i);
  const timeWindow = timeWindowMatch ? timeWindowMatch[1] : undefined;

  // Look for red flag phrases
  const redFlagPhrases = [
    "hemorrhage",
    "bleeding",
    "contraindicated",
    "do not",
    "avoid",
    "allergy",
    "anaphylaxis",
  ];
  const redFlags = redFlagPhrases.filter((phrase) =>
    text.toLowerCase().includes(phrase)
  );

  // Determine source name
  const primary = diagnosis.primary.toLowerCase();
  let source = "Clinical Guidelines Search";
  if (primary.includes("stroke") || primary.includes("ischemic")) {
    source = "AHA/ASA Ischemic Stroke Guidelines";
  } else if (primary.includes("stemi") || primary.includes("myocardial")) {
    source = "ACC/AHA STEMI Guidelines";
  }

  const summary =
    recommendations.length > 0
      ? recommendations[0].text
      : `Clinical guidelines for ${diagnosis.primary}`;

  return {
    condition: diagnosis.primary,
    source,
    recommendations,
    timeWindow,
    redFlags: redFlags.length > 0 ? redFlags : undefined,
    summary,
  };
}

export async function apifyGuidelinesLookup(
  diagnosis: DiagnosisResult
): Promise<GuidelineResult | null> {
  const token = process.env.APIFY_API_TOKEN;

  if (!token) {
    console.log("[apify-guidelines] APIFY_API_TOKEN not set — skipping Apify lookup");
    return null;
  }

  const client = new ApifyClient({ token });
  const searchUrl = buildSearchUrl(diagnosis);

  console.log(
    `[apify-guidelines] Scraping guidelines for "${diagnosis.primary}" via: ${searchUrl}`
  );

  try {
    const result = await Promise.race([
      (async () => {
        const run = await client.actor("apify/web-scraper").call({
          startUrls: [{ url: searchUrl }],
          pageFunction: `async function pageFunction(context) {
            const { page } = context;
            const text = await page.evaluate(() => document.body.innerText);
            return { text: text.substring(0, 8000) };
          }`,
          maxPagesPerCrawl: 1,
          maxCrawlingDepth: 0,
        });

        const { items } = await client
          .dataset(run.defaultDatasetId)
          .listItems();

        if (!items.length) {
          console.warn("[apify-guidelines] No items returned from scraper");
          return null;
        }

        const firstItem = items[0] as Record<string, unknown>;
        const text = (firstItem.text as string) ?? "";

        if (!text || text.length < 100) {
          console.warn("[apify-guidelines] Scraped text too short, falling back");
          return null;
        }

        const guidelineResult = parseScrapedText(text, diagnosis);

        console.log(
          `[apify-guidelines] Success — source: "${guidelineResult.source}", ${guidelineResult.recommendations.length} recommendation(s)`
        );

        return guidelineResult;
      })(),
      new Promise<null>((resolve) =>
        setTimeout(() => {
          console.warn("[apify-guidelines] Timed out after 20s — falling back");
          resolve(null);
        }, TIMEOUT_MS)
      ),
    ]);

    return result;
  } catch (err) {
    console.warn("[apify-guidelines] Lookup failed, falling back:", err);
    return null;
  }
}
