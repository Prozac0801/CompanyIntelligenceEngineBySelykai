import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { resolveContactEligibility } from "@/lib/intelligence/contact-eligibility";
import { getHunterContacts } from "@/lib/providers";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siren: string }> },
) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  const { siren } = await params;
  if (!/^\d{9}$/.test(siren)) {
    return NextResponse.json({ error: "invalid_siren" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const eligibility = await resolveContactEligibility(siren);
  if (!eligibility) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const reuse = eligibility.policy;
  if (reuse.status !== "allowed") {
    return NextResponse.json(
      {
        error: reuse.status === "blocked" ? "commercial_reuse_blocked" : "commercial_reuse_not_confirmed",
        reason: reuse.reason,
        policyStatus: reuse.status,
      },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  const domain = eligibility.domain;
  if (!domain) {
    return NextResponse.json(
      { error: "domain_not_resolved" },
      { status: 404, headers: PRIVATE_HEADERS },
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
      policyStatus: reuse.status,
      eligibilitySource: eligibility.source,
      dataPolicy: "Contacts professionnels révélés à la demande uniquement lorsque le statut de réutilisation commerciale RNE est explicitement autorisé. Aucun enrichissement personnel massif n’est lancé automatiquement.",
    },
    { headers: PRIVATE_HEADERS },
  );
}
