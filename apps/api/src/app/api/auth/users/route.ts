import { NextResponse } from "next/server";
import { getAvailableUsers } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ users: getAvailableUsers() });
}
