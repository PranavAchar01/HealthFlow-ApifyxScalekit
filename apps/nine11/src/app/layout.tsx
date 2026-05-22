import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "HealthFlow 911 - Emergency Dispatch", description: "Pre-load patient scenarios and launch the emergency pipeline" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
