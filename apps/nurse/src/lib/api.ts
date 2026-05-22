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
