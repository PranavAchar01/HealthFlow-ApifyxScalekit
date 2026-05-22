"use client";

import { useState, useEffect } from "react";
import { Encounter } from "@/types";

interface DemoUser {
  tokenKey: string;
  userId: string;
  name: string;
  role: string;
  permissions: string[];
}

export default function AdminCRM() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [users, setUsers] = useState<DemoUser[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/encounters`).then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/auth/users`).then((r) => r.json()),
    ]).then(([encData, userData]) => {
      setEncounters(encData.encounters);
      setUsers(userData.users);
    });
  }, []);

  const agentStats = encounters.reduce((acc, enc) => {
    for (const entry of enc.auditTrail) {
      acc[entry.agentRole] = (acc[entry.agentRole] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">System Administration</h2>
        <p className="text-sm text-gray-500">User management, system health, and agent metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900">Registered Users (Scalekit)</h3>
          </div>
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.tokenKey} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role} | Token: {user.tokenKey}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    user.role === "physician" ? "bg-blue-100 text-blue-700" :
                    user.role === "paramedic" ? "bg-emerald-100 text-emerald-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.permissions.map((p) => (
                    <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Metrics */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900">Agent Execution Metrics</h3>
          </div>
          <div className="px-6 py-4">
            {Object.entries(agentStats).length === 0 ? (
              <p className="text-gray-400 text-sm">No agent executions yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(agentStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([agent, count]) => {
                    const maxCount = Math.max(...Object.values(agentStats));
                    return (
                      <div key={agent}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-mono text-gray-700">{agent}</span>
                          <span className="text-gray-500">{count} executions</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div
                            className="h-2 bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* System Config */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900">System Configuration</h3>
          </div>
          <div className="px-6 py-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Agent Engine</dt>
                <dd className="font-medium text-gray-900">LangChain + Claude Sonnet</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Voice STT</dt>
                <dd className="font-medium text-gray-900">ElevenLabs Scribe v1</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Auth Provider</dt>
                <dd className="font-medium text-gray-900">Scalekit (Demo Mode)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Drug Safety</dt>
                <dd className="font-medium text-gray-900">Apify Actor (Mock DB)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Audit Provider</dt>
                <dd className="font-medium text-gray-900">Entire.io (Local SHA-256)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Data Format</dt>
                <dd className="font-medium text-gray-900">FHIR R4</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Store</dt>
                <dd className="font-medium text-gray-900">In-Memory (Supabase ready)</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* CRM Topology */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900">CRM Topology</h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-3">
              {[
                { name: "Command Center", path: "/crm", desc: "Aggregate overview with approval actions", status: "online" },
                { name: "Field Ops", path: "/crm/field", desc: "Paramedic dispatch tracking", status: "online" },
                { name: "Physician Review", path: "/crm/doctor", desc: "Clinical review and order approval", status: "online" },
                { name: "Audit Trail", path: "/crm/audit", desc: "Immutable compliance log", status: "online" },
                { name: "Admin Panel", path: "/crm/admin", desc: "System config and user management", status: "online" },
              ].map((crm) => (
                <div key={crm.path} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{crm.name}</p>
                    <p className="text-xs text-gray-500">{crm.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-xs text-emerald-600 font-medium">{crm.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
