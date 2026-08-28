import { getCompanyBySiren } from "@/lib/providers";
import { persistCanonicalCompany } from "@/lib/persistence/company-context-repository";
import type { CompanyProfile } from "@/types/company";

export async function bootstrapCompany(siren: string): Promise<CompanyProfile | null> {
  const company = await getCompanyBySiren(siren);
  if (!company) return null;
  await persistCanonicalCompany(company);
  return company;
}
