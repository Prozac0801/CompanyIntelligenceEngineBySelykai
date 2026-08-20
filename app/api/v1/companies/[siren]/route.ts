import { NextResponse } from "next/server";
import { getCompanyBySiren } from "@/lib/providers";
import { computeOpportunityScore } from "@/lib/scoring/opportunity";

export async function GET(_request: Request, context: { params: Promise<{ siren: string }> }) {
  const { siren } = await context.params;
  if (!/^\d{9}$/.test(siren)) {
    return NextResponse.json({ error: "SIREN invalide." }, { status: 400 });
  }

  try {
    const company = await getCompanyBySiren(siren);
    if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
    return NextResponse.json({ company, score: computeOpportunityScore(company) }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Source entreprise indisponible." },
      { status: 502 },
    );
  }
}
