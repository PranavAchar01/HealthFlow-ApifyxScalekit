import { NextResponse } from "next/server";

// Production URLs (hardcoded as fallback — env vars override these)
const PRODUCTION_ORIGINS = [
  "https://nine11-black.vercel.app",
  "https://guestflow-paramedic.vercel.app",
  "https://guestflow-doctor.vercel.app",
  "https://nurse-seven.vercel.app",
];

const ALLOWED_ORIGINS = [
  // local dev
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  // production (env vars)
  process.env.PARAMEDIC_APP_URL,
  process.env.DOCTOR_APP_URL,
  process.env.NURSE_APP_URL,
  process.env.NINE11_APP_URL,
  // production fallbacks (always allowed)
  ...PRODUCTION_ORIGINS,
].filter(Boolean) as string[];

export function corsHeaders(origin: string | null) {
  // Allow if origin matches, or allow all for requests with no origin (server-to-server)
  const isAllowed = !origin || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin ?? "*") : "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function corsResponse(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
