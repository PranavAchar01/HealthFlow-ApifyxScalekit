import { AuditEntry, AgentRole } from "@/types";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const auditLog: AuditEntry[] = [];

export function createAuditEntry(
  agentRole: AgentRole,
  action: string,
  details: string,
  userId?: string,
  userName?: string
): AuditEntry {
  const entry: AuditEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    agentRole,
    action,
    details,
    userId,
    userName,
  };

  entry.checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify({ ...entry, checksum: undefined }))
    .digest("hex");

  auditLog.push(entry);
  return entry;
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}

export function getAuditLogForEncounter(encounterId: string): AuditEntry[] {
  return auditLog.filter((e) => e.details.includes(encounterId));
}

export function verifyAuditEntry(entry: AuditEntry): boolean {
  const expected = crypto
    .createHash("sha256")
    .update(JSON.stringify({ ...entry, checksum: undefined }))
    .digest("hex");
  return expected === entry.checksum;
}
