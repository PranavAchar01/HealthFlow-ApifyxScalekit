import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuestFlow API",
  description: "GuestFlow backend — multi-agent healthcare pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
