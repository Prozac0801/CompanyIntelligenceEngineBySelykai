import { NextResponse } from "next/server";
import { analyzeCompany } from "@/lib/intelligence/company-engine";

export async function GET(_request: Request, context: { params: Promise<{ siren: string }> }) {
  const { siren } = await context.params;
  if (!/^\d{9}$/.test(siren)) {
    return NextResponse.json({ error: "SIREN invalide." }, { status: 400 });
  }

  try {
    const analysis = await analyzeCompany(siren);
    if (!analysis) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

    return NextResponse.json(analysis, {
      headers: {
        "Cache-Control": analysis.meta.databaseConfigured
          ? "private, no-store"
          : "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Source entreprise indisponible." },
      { status: 502 },
    );
  }
}
