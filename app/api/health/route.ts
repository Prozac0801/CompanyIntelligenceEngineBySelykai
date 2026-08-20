import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { LIVE_PROVIDERS } from "@/lib/providers/catalog";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Selykai Company Intelligence Engine",
    version: "0.1.0",
    database: hasDatabase() ? "configured" : "not-configured",
    liveSources: LIVE_PROVIDERS.map((provider) => provider.id),
    timestamp: new Date().toISOString(),
  });
}
