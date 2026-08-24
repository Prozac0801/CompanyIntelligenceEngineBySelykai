import { hasDatabase, sqlClient } from "@/lib/db";
import { canWriteRuntimeState } from "@/lib/runtime/write-policy";
import type { CompanyProfile, SourceKind } from "@/types/company";
import type { CompanyFact, FactValue } from "@/types/intelligence";

export interface PersistedContactContext {
  domain?: string;
  domainObservedAt?: string;
  facts: CompanyFact[];
}

export async function persistCanonicalCompany(company: CompanyProfile): Promise<boolean> {
  if (!hasDatabase() || !canWriteRuntimeState()) return false;
  const sql = sqlClient();
  const headOfficeSiret = company.establishments.find((item) => item.headOffice)?.siret || null;
  const rows = (await sql`
    INSERT INTO companies (
      siren, legal_name, display_name, legal_form_code, naf_code,
      administrative_state, employee_band, company_category, employer,
      creation_date, head_office_siret, updated_at
    ) VALUES (
      ${company.siren}, ${company.name}, ${company.name}, ${company.legalForm || null}, ${company.nafCode || null},
      ${company.status}, ${company.employeeBand || null}, ${company.companyCategory || null}, ${company.employer ?? null},
      ${company.createdAt || null}, ${headOfficeSiret}, now()
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
      updated_at = now()
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  const companyId = rows[0]?.id;
  if (!companyId) return false;

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

  return true;
}

export async function loadPersistedContactContext(siren: string): Promise<PersistedContactContext | null> {
  if (!hasDatabase()) return null;
  const sql = sqlClient();
  const rows = (await sql`
    SELECT
      c.canonical_domain,
      cd.last_observed_at AS domain_observed_at,
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
    FROM companies c
    LEFT JOIN LATERAL (
      SELECT last_observed_at
      FROM company_domains
      WHERE company_id = c.id
        AND domain = c.canonical_domain
      ORDER BY is_primary DESC, last_observed_at DESC
      LIMIT 1
    ) cd ON true
    LEFT JOIN LATERAL (
      SELECT fact_type, fact_key, value, confidence, source_url, last_observed_at, fingerprint, provider_id
      FROM company_facts
      WHERE company_id = c.id AND fact_key = 'commercial_prospecting_allowed'
      ORDER BY last_observed_at DESC
      LIMIT 1
    ) cf ON true
    LEFT JOIN providers p ON p.id = cf.provider_id
    WHERE c.siren = ${siren}
    LIMIT 1
  `) as unknown as Array<{
    canonical_domain: string | null;
    domain_observed_at: string | Date | null;
    fact_type: CompanyFact["type"] | null;
    fact_key: string | null;
    value: FactValue | null;
    confidence: string | number | null;
    source_url: string | null;
    last_observed_at: string | Date | null;
    fingerprint: string | null;
    provider_id: string | null;
    provider_name: string | null;
    provider_kind: SourceKind | null;
  }>;

  const row = rows[0];
  if (!row) return null;
  const facts: CompanyFact[] = [];
  if (
    row.fact_type && row.fact_key && row.fingerprint && row.provider_id && row.provider_name
    && row.provider_kind && row.last_observed_at && row.confidence !== null
  ) {
    facts.push({
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
    });
  }

  return {
    domain: row.canonical_domain || undefined,
    domainObservedAt: row.domain_observed_at ? new Date(row.domain_observed_at).toISOString() : undefined,
    facts,
  };
}
