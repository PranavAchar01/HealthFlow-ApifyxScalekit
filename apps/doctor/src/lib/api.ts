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
