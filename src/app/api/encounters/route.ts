import { NextResponse } from "next/server";
import { getAllEncounters } from "@/lib/store";

export async function GET() {
  const encounters = getAllEncounters();
  return NextResponse.json({ encounters });
}
