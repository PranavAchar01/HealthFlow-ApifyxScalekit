import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuestFlow Doctor CRM",
  description: "Physician clinical review and order approval dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50">{children}</body>
    </html>
  );
}
