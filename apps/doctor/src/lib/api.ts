import type { Encounter } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DOCTOR_TOKEN = "dr_chen";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DOCTOR_TOKEN}`,
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

export async function commitEncounter(encounterId: string): Promise<{ encounter: Encounter; ehrCommit: unknown }> {
  return apiFetch("/api/agents/commit", {
    method: "POST",
    body: JSON.stringify({ encounterId }),
  });
}

export async function getDemoUsers(): Promise<unknown[]> {
  const data = await apiFetch<{ users: unknown[] }>("/api/auth/users");
  return data.users;
}

export type EncounterStreamHandlers = {
  onSnapshot: (encounters: Encounter[], selectedId?: string | null) => void;
  onUpsert: (encounter: Encounter) => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string | null) => void;
  onError?: (err: Event) => void;
};

export function subscribeToEncounters(handlers: EncounterStreamHandlers): () => void {
  if (typeof window === "undefined") return () => {};
  const es = new EventSource(`${API_URL}/api/encounters/stream`);

  es.addEventListener("snapshot", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { encounters: Encounter[]; selectedId?: string | null };
      handlers.onSnapshot(data.encounters, data.selectedId ?? null);
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

  es.addEventListener("select", (e) => {
    try {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: string | null };
      handlers.onSelect?.(id);
    } catch (err) { console.error("[stream] select parse", err); }
  });

  es.onerror = (err) => { handlers.onError?.(err); };

  return () => es.close();
}
