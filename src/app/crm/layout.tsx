"use client";

import { CrmNav } from "@/components/crm/CrmNav";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold">
              HF
            </div>
            <div>
              <h1 className="font-bold text-sm">HealthFlow CRM</h1>
              <p className="text-xs text-gray-400">Multi-Agent Healthcare Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-400">All Systems Online</span>
          </div>
        </div>
      </header>
      <CrmNav />
      <main>{children}</main>
    </div>
  );
}
