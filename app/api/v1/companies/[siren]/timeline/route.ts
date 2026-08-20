import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { loadCompanyTimeline } from "@/lib/persistence/company-repository";

export async function GET(_request: Request, context: { params: Promise<{ siren: string }> }) {
  const { siren } = await context.params;
  if (!/^\d{9}$/.test(siren)) {
    return NextResponse.json({ error: "SIREN invalide." }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Timeline indisponible tant que la base Neon dédiée n'est pas connectée." },
      { status: 503 },
    );
  }

  try {
    const events = await loadCompanyTimeline(siren);
    return NextResponse.json({ siren, events, total: events.length }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Timeline indisponible." },
      { status: 500 },
    );
  }
}
