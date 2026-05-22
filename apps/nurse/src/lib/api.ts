import type { Encounter } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const NURSE_TOKEN = "nurse_rodriguez";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NURSE_TOKEN}`,
      ...init?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data;
}

export async function getEncounters(): Promise<Encounter[]> {
  const data = await apiFetch<{ encounters: Encounter[] }>("/api/encounters");
  return data.encounters;
}

export async function addNursingNote(
  encounterId: string,
  note: string,
  category: string
): Promise<Encounter> {
  const data = await apiFetch<{ encounter: Encounter }>(`/api/encounters/${encounterId}`, {
    method: "PATCH",
    body: JSON.stringify({ note, category }),
  });
  return data.encounter;
}

export async function setTriageStatus(
  encounterId: string,
  triageStatus: string
): Promise<Encounter> {
  const data = await apiFetch<{ encounter: Encounter }>(`/api/encounters/${encounterId}`, {
    method: "PATCH",
    body: JSON.stringify({ triageStatus }),
  });
  return data.encounter;
}

export type EncounterStreamHandlers = {
  onSnapshot: (encounters: Encounter[]) => void;
  onUpsert: (encounter: Encounter) => void;
  onDelete?: (id: string) => void;
  onError?: (err: Event) => void;
};

// EventSource doesn't support custom headers, so the stream endpoint is
// authenticated by origin (CORS). Returns a disposer.
export function subscribeToEncounters(handlers: EncounterStreamHandlers): () => void {
  if (typeof window === "undefined") return () => {};
  const es = new EventSource(`${API_URL}/api/encounters/stream`);

  es.addEventListener("snapshot", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { encounters: Encounter[] };
      handlers.onSnapshot(data.encounters);
    } catch (err) { console.error("[stream] snapshot parse", err); }
  });

  es.addEventListener("upsert", (e) => {
    try {
      const enc = JSON.parse((e as MessageEvent).data) as Encounter;
      handlers.onUpsert(enc);
    } catch (err) { console.error("[stream] upsert parse", err); }
  });

  es.addEventListener("delete", (e) => {
    try {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: string };
      handlers.onDelete?.(id);
    } catch (err) { console.error("[stream] delete parse", err); }
  });

  es.onerror = (err) => {
    handlers.onError?.(err);
    // EventSource auto-reconnects; we leave the connection open.
  };

  return () => es.close();
}
