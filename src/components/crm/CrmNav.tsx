"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/crm", label: "Command Center", icon: "📊", role: "Overview" },
  { href: "/crm/field", label: "Field Ops", icon: "🚑", role: "Paramedic Dispatch" },
  { href: "/crm/doctor", label: "Physician", icon: "👨‍⚕️", role: "Clinical Review" },
  { href: "/crm/audit", label: "Audit Trail", icon: "📜", role: "Compliance" },
  { href: "/crm/admin", label: "Admin", icon: "⚙️", role: "System Admin" },
];

export function CrmNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/paramedic"
              className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-200 rounded-full"
            >
              Paramedic UI
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
