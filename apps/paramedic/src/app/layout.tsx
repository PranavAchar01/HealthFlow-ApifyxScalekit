import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "GuestFlow Field — Paramedic", description: "ElevenLabs voice dictation and field data entry" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="h-screen overflow-hidden">{children}</body></html>;
}
