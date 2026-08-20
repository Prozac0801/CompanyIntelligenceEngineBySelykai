import { createHash } from "node:crypto";
import { hasDatabase, sqlClient } from "@/lib/db";
import type {
  CompanyEnrichment,
  CompanyProfile,
  ExplainableScore,
  SourceKind,
} from "@/types/company";
import type { CompanyEvent, CompanyFact, CompanySignal, FactValue } from "@/types/intelligence";

interface LatestFactRow {
  fact_type: CompanyFact["type"];
  fact_key: string;
  value: FactValue;
  confidence: string | number;
  source_url: string | null;
  last_observed_at: string | Date;
  provider_id: string;
  provider_name: string;
  provider_kind: SourceKind;
  fingerprint: string;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stableSnapshotPayload(facts: CompanyFact[]) {
  return facts
    .map((fact) => ({ key: fact.key, value: fact.value, fingerprint: fact.fingerprint }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function eventFingerprint(event: CompanyEvent): string {
  return hash({
    type: event.type,
    description: event.description,
    evidenceKeys: [...event.evidenceKeys].sort(),
  });
}

export async function loadLatestFacts(siren: string): Promise<Map<string, CompanyFact>> {
  if (!hasDatabase()) return new Map();
  const sql = sqlClient();
  const rows = (await sql`
    SELECT DISTINCT ON (cf.fact_key)
      cf.fact_type,
      cf.fact_key,
      cf.value,
      cf.confidence,
      cf.source_url,
      cf.last_observed_at,
      cf.fingerprint,
      p.id AS provider_id,
      p.name AS provider_name,
      p.kind AS provider_kind
    FROM company_facts cf
    JOIN companies c ON c.id = cf.company_id
    JOIN providers p ON p.id = cf.provider_id
    WHERE c.siren = ${siren}
    ORDER BY cf.fact_key, cf.last_observed_at DESC
  `) as unknown as LatestFactRow[];

  return new Map(
    rows.map((row) => [
      row.fact_key,
      {
        type: row.fact_type,
        key: row.fact_key,
        value: row.value,
        fingerprint: row.fingerprint,
        evidence: {
          providerId: row.provider_id,
          provider: row.provider_name,
          kind: row.provider_kind,
          observedAt: new Date(row.last_observed_at).toISOString(),
          sourceUrl: row.source_url || undefined,
          confidence: Number(row.confidence),
        },
      },
    ]),
  );
}

export async function persistCompanyAnalysis(input: {
  company: CompanyProfile;
  enrichment: CompanyEnrichment;
  facts: CompanyFact[];
  events: CompanyEvent[];
  signals: CompanySignal[];
  score: ExplainableScore;
}): Promise<boolean> {
  if (!hasDatabase()) return false;
  const { company, enrichment, facts, events, signals, score } = input;
  const sql = sqlClient();
  const headOfficeSiret = company.establishments.find((item) => item.headOffice)?.siret || null;
  const canonicalDomain = enrichment.web?.domain || null;

  const companyRows = (await sql`
    INSERT INTO companies (
      siren, legal_name, display_name, legal_form_code, naf_code,
      administrative_state, employee_band, company_category, employer,
      creation_date, head_office_siret, canonical_domain, updated_at
    ) VALUES (
      ${company.siren}, ${company.name}, ${company.name}, ${company.legalForm || null}, ${company.nafCode || null},
      ${company.status}, ${company.employeeBand || null}, ${company.companyCategory || null}, ${company.employer ?? null},
      ${company.createdAt || null}, ${headOfficeSiret}, ${canonicalDomain}, now()
    )
    ON CONFLICT (siren) DO UPDATE SET
      legal_name = EXCLUDED.legal_name,
      display_name = EXCLUDED.display_name,
      legal_form_code = EXCLUDED.legal_form_code,
      naf_code = EXCLUDED.naf_code,
      administrative_state = EXCLUDED.administrative_state,
      employee_band = EXCLUDED.employee_band,
      company_category = EXCLUDED.company_category,
      employer = EXCLUDED.employer,
      creation_date = EXCLUDED.creation_date,
      head_office_siret = EXCLUDED.head_office_siret,
      canonical_domain = COALESCE(EXCLUDED.canonical_domain, companies.canonical_domain),
      updated_at = now()
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  const companyId = companyRows[0]?.id;
  if (!companyId) throw new Error("Impossible de persister l’entreprise.");

  if (canonicalDomain) {
    const domainEvidence = enrichment.evidence.find((item) => item.providerId === "hunter") ||
      enrichment.evidence.find((item) => item.providerId === "apilayer");
    await sql`
      INSERT INTO company_domains (
        company_id, domain, is_primary, provider_id, confidence,
        first_observed_at, last_observed_at
      ) VALUES (
        ${companyId}, ${canonicalDomain}, true, ${domainEvidence?.providerId || "hunter"},
        ${domainEvidence?.confidence ?? 0.75}, now(), now()
      )
      ON CONFLICT (company_id, domain) DO UPDATE SET
        is_primary = true,
        confidence = GREATEST(company_domains.confidence, EXCLUDED.confidence),
        last_observed_at = now()
    `;
  }

  for (const establishment of company.establishments) {
    if (!establishment.siret) continue;
    await sql`
      INSERT INTO establishments (
        company_id, siret, is_head_office, administrative_state, naf_code,
        address, postal_code, city, opening_date, last_observed_at
      ) VALUES (
        ${companyId}, ${establishment.siret}, ${establishment.headOffice ?? false},
        ${establishment.active === undefined ? null : establishment.active ? "active" : "closed"},
        ${establishment.nafCode || null}, ${establishment.address || null}, ${establishment.postalCode || null},
        ${establishment.city || null}, ${establishment.createdAt || null}, now()
      )
      ON CONFLICT (siret) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        is_head_office = EXCLUDED.is_head_office,
        administrative_state = EXCLUDED.administrative_state,
        naf_code = EXCLUDED.naf_code,
        address = EXCLUDED.address,
        postal_code = EXCLUDED.postal_code,
        city = EXCLUDED.city,
        opening_date = EXCLUDED.opening_date,
        last_observed_at = now()
    `;
  }

  for (const fact of facts) {
    const providerId = fact.evidence.providerId || "recherche-entreprises";
    await sql`
      INSERT INTO company_facts (
        company_id, provider_id, fact_type, fact_key, value, confidence,
        source_url, first_observed_at, last_observed_at, fingerprint
      ) VALUES (
        ${companyId}, ${providerId}, ${fact.type}, ${fact.key}, ${JSON.stringify(fact.value)}::jsonb,
        ${fact.evidence.confidence}, ${fact.evidence.sourceUrl || null}, now(), now(), ${fact.fingerprint}
      )
      ON CONFLICT (company_id, provider_id, fingerprint) DO UPDATE SET
        last_observed_at = now(),
        confidence = GREATEST(company_facts.confidence, EXCLUDED.confidence),
        source_url = COALESCE(EXCLUDED.source_url, company_facts.source_url)
    `;
  }

  const snapshot = stableSnapshotPayload(facts);
  const snapshotHash = hash(snapshot);
  await sql`
    INSERT INTO company_snapshots (company_id, snapshot_hash, facts, first_captured_at, last_captured_at)
    VALUES (${companyId}, ${snapshotHash}, ${JSON.stringify(snapshot)}::jsonb, now(), now())
    ON CONFLICT (company_id, snapshot_hash) DO UPDATE SET last_captured_at = now()
  `;

  const defaultProviderId = company.evidence[0]?.providerId || "recherche-entreprises";
  for (const event of events) {
    await sql`
      INSERT INTO company_events (
        company_id, provider_id, event_type, title, description, event_date,
        confidence, evidence_keys, fingerprint
      ) VALUES (
        ${companyId}, ${defaultProviderId}, ${event.type}, ${event.title}, ${event.description},
        ${event.observedAt}, ${event.confidence}, ${event.evidenceKeys}, ${eventFingerprint(event)}
      )
      ON CONFLICT (company_id, fingerprint) DO NOTHING
    `;
  }

  for (const signal of signals) {
    await sql`
      INSERT INTO company_signals (
        company_id, signal_type, label, strength, reason, evidence_event_types, generated_at
      ) VALUES (
        ${companyId}, ${signal.type}, ${signal.label}, ${signal.strength}, ${signal.reason},
        ${signal.evidenceEventTypes}, now()
      )
    `;
  }

  await sql`
    INSERT INTO company_scores (company_id, score_type, score_version, value, confidence, factors, computed_at)
    VALUES (
      ${companyId}, 'opportunity', ${score.version}, ${score.value}, ${score.confidence},
      ${JSON.stringify(score.factors)}::jsonb, now()
    )
  `;

  return true;
}

export async function loadCompanyTimeline(siren: string, limit = 30): Promise<CompanyEvent[]> {
  if (!hasDatabase()) return [];
  const sql = sqlClient();
  const rows = (await sql`
    SELECT ce.event_type, ce.title, ce.description, ce.event_date, ce.confidence, ce.evidence_keys
    FROM company_events ce
    JOIN companies c ON c.id = ce.company_id
    WHERE c.siren = ${siren}
    ORDER BY ce.event_date DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `) as unknown as Array<{
    event_type: CompanyEvent["type"];
    title: string;
    description: string;
    event_date: string | Date;
    confidence: string | number;
    evidence_keys: string[];
  }>;

  return rows.map((row) => ({
    type: row.event_type,
    title: row.title,
    description: row.description,
    observedAt: new Date(row.event_date).toISOString(),
    confidence: Number(row.confidence),
    evidenceKeys: row.evidence_keys,
  }));
}
