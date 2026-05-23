import { Encounter } from "@/types";

const encounters = new Map<string, Encounter>();
const listeners = new Set<(encounter: Encounter) => void>();

export function getEncounter(id: string): Encounter | undefined {
  return encounters.get(id);
}

export function getAllEncounters(): Encounter[] {
  return Array.from(encounters.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function upsertEncounter(encounter: Encounter): Encounter {
  encounter.updatedAt = new Date().toISOString();
  encounters.set(encounter.id, encounter);
  listeners.forEach((fn) => fn(encounter));
  return encounter;
}

export function deleteEncounter(id: string): boolean {
  return encounters.delete(id);
}

export function onEncounterUpdate(fn: (encounter: Encounter) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
