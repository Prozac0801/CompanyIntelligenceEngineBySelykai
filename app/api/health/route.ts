import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/db";
import { authConfigurationHealth } from "@/lib/auth/server";
import { getProviderCatalog } from "@/lib/providers/catalog";

export async function GET() {
  const database = await checkDatabase();
  const auth = authConfigurationHealth();
  const providers = getProviderCatalog();
  const healthy = !database.configured || (database.reachable && database.schemaReady);
  const configuredSources = providers
    .filter((provider) => provider.status !== "next")
    .map((provider) => provider.id);

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
      providerPipeline: providers.map(({ id, status }) => ({ id, status })),
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
