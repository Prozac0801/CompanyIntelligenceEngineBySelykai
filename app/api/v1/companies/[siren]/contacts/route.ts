import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import { commercialReuseDecision, getHunterContacts } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siren: string }> },
) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { siren } = await params;
  if (!/^\d{9}$/.test(siren)) {
    return NextResponse.json({ error: "invalid_siren" }, { status: 400 });
  }

  const analysis = await analyzeCompany(siren, { persist: false });
  if (!analysis) return NextResponse.json({ error: "company_not_found" }, { status: 404 });

  const reuse = commercialReuseDecision(analysis.facts);
  if (reuse.status === "blocked") {
    return NextResponse.json(
      { error: "commercial_reuse_blocked", reason: reuse.reason },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const domain = analysis.enrichment.web?.domain;
  if (!domain) {
    return NextResponse.json(
      { error: "domain_not_resolved" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const url = new URL(request.url);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "8", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 10)) : 8;
  const contacts = await getHunterContacts(domain, limit);

  return NextResponse.json(
    {
      domain,
      contacts,
      count: contacts.length,
      dataPolicy: "Contacts professionnels révélés à la demande. Aucun enrichissement personnel massif n’est lancé automatiquement.",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
