import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuestFlow Nurse Station",
  description: "Nursing triage, assessment, and patient handoff dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50">{children}</body>
    </html>
  );
}
