import { NextResponse } from "next/server";
import { querySummary } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const rows = await querySummary(limit);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Summary API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database error" },
      { status: 500 }
    );
  }
}
