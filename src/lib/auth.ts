import { AuthToken } from "@/types";

const DEMO_USERS: Record<string, AuthToken> = {
  paramedic_sarah: {
    userId: "pm-001",
    name: "Sarah Mitchell",
    role: "paramedic",
    permissions: ["field_data_entry", "view_encounters"],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  },
  dr_chen: {
    userId: "dr-001",
    name: "Dr. James Chen",
    role: "physician",
    permissions: ["cpoe", "view_encounters", "approve_orders", "ehr_write"],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  },
  admin_ops: {
    userId: "admin-001",
    name: "Admin Operations",
    role: "admin",
    permissions: ["view_encounters", "view_audit", "manage_users"],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  },
};

export function validateToken(authHeader: string | null): AuthToken | null {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  return DEMO_USERS[token] ?? null;
}

export function requirePermission(token: AuthToken, permission: string): boolean {
  return token.permissions.includes(permission);
}

export function getAvailableUsers() {
  return Object.entries(DEMO_USERS).map(([key, user]) => ({
    tokenKey: key,
    ...user,
  }));
}
