import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/db";
import { LIVE_PROVIDERS } from "@/lib/providers/catalog";

export async function GET() {
  const database = await checkDatabase();
  const healthy = !database.configured || (database.reachable && database.schemaReady);

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "Selykai Company Intelligence Engine",
      version: "0.2.0",
      database,
      liveSources: LIVE_PROVIDERS.map((provider) => provider.id),
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
