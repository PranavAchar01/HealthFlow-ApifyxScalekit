import { NextRequest, NextResponse } from "next/server";
import { getEncounter } from "@/lib/store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encounter = getEncounter(id);

  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
  }

  return NextResponse.json({ encounter });
}
