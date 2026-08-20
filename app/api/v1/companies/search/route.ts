import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/providers";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2) {
    return NextResponse.json({ error: "La recherche doit contenir au moins 2 caractères." }, { status: 400 });
  }

  try {
    const result = await searchCompanies(query);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Source entreprise indisponible." },
      { status: 502 },
    );
  }
}
