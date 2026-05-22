import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "GuestFlow Doctor CRM", description: "Physician clinical review and EHR order approval" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="h-screen overflow-hidden">{children}</body></html>;
}
