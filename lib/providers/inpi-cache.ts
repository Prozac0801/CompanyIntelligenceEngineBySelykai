import { readProviderCache, writeProviderCache } from "./cache";
import { getInpiRneSupplement, type InpiRneSupplement } from "./inpi-rne";

export const INPI_COMPANY_CACHE_TTL_SECONDS = 60 * 60;

export function inpiCompanyCacheKey(siren: string): string {
  return `inpi-rne:company:v2:${siren}`;
}

export async function getCachedInpiRneSupplement(siren: string): Promise<InpiRneSupplement> {
  const cacheKey = inpiCompanyCacheKey(siren);
  const cached = await readProviderCache<InpiRneSupplement>(cacheKey);
  if (cached) return cached;

  const supplement = await getInpiRneSupplement(siren);
  await writeProviderCache("inpi-rne", cacheKey, supplement, INPI_COMPANY_CACHE_TTL_SECONDS);
  return supplement;
}
