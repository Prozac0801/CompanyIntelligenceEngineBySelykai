import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/db";
import { authConfigurationHealth } from "@/lib/auth/server";
import { isInpiRneConfigured } from "@/lib/providers";
import { LIVE_PROVIDERS } from "@/lib/providers/catalog";

export async function GET() {
  const database = await checkDatabase();
  const auth = authConfigurationHealth();
  const healthy = !database.configured || (database.reachable && database.schemaReady);
  const configuredSources = [
    ...LIVE_PROVIDERS.map((provider) => provider.id),
    ...(isInpiRneConfigured() ? ["inpi-rne"] : []),
  ];

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "Selykai Company Intelligence Engine",
      version: "0.2.0",
      database,
      auth: {
        provider: "neon-auth",
        ...auth,
        protectedSurface: "/workspace",
      },
      configuredSources,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
