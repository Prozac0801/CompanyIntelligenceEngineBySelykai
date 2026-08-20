import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runMonitoringBatch } from "@/lib/monitoring/run-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;

  const supplied = authorization.slice(prefix.length);
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function batchSize(): number {
  const configured = Number.parseInt(process.env.MONITOR_BATCH_SIZE || "20", 10);
  if (!Number.isFinite(configured)) return 20;
  return Math.max(1, Math.min(configured, 100));
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "monitoring_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!authorized(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runMonitoringBatch(batchSize());
    return NextResponse.json(
      { status: "ok", ...result, completedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Monitoring batch failed.",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      { error: "monitoring_batch_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
