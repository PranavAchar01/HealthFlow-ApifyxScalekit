import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:3002",
  "http://localhost:3003",
  process.env.PARAMEDIC_APP_URL,
  process.env.DOCTOR_APP_URL,
].filter(Boolean) as string[];

export function corsHeaders(origin: string | null) {
  const allowed = !origin || ALLOWED_ORIGINS.includes(origin) ? origin ?? "*" : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function corsResponse(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
