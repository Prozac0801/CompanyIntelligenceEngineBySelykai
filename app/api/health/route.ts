import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Selykai Company Intelligence Engine",
    version: "0.1.0",
    database: hasDatabase() ? "configured" : "not-configured",
    liveSources: ["recherche-entreprises"],
    timestamp: new Date().toISOString(),
  });
}
