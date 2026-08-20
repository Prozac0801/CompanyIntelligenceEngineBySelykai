import { createNeonAuth } from "@neondatabase/auth/next/server";

export type AuthBaseUrlSource =
  | "NEON_AUTH_BASE_URL"
  | "CompanyIntelligenceEngine_NEON_AUTH_BASE_URL";

const AUTH_BASE_URL_CANDIDATES: readonly AuthBaseUrlSource[] = [
  "NEON_AUTH_BASE_URL",
  "CompanyIntelligenceEngine_NEON_AUTH_BASE_URL",
] as const;

function resolveAuthBaseUrl(): { value?: string; source?: AuthBaseUrlSource } {
  for (const source of AUTH_BASE_URL_CANDIDATES) {
    const value = process.env[source]?.trim();
    if (value) return { value, source };
  }
  return {};
}

const configuredBaseUrl = resolveAuthBaseUrl();
const configuredCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();

export interface AuthConfigurationHealth {
  configured: boolean;
  baseUrlConfigured: boolean;
  baseUrlSource?: AuthBaseUrlSource;
  cookieSecretConfigured: boolean;
}

export function authConfigurationHealth(): AuthConfigurationHealth {
  const baseUrlConfigured = Boolean(configuredBaseUrl.value);
  const cookieSecretConfigured = Boolean(
    configuredCookieSecret && configuredCookieSecret.length >= 32,
  );

  return {
    configured: baseUrlConfigured && cookieSecretConfigured,
    baseUrlConfigured,
    baseUrlSource: configuredBaseUrl.source,
    cookieSecretConfigured,
  };
}

export function isAuthConfigured(): boolean {
  return authConfigurationHealth().configured;
}

// Build-safe placeholders keep CI deterministic. Every user-facing auth operation checks
// isAuthConfigured() first, so these values are never treated as a production fallback.
export const auth = createNeonAuth({
  baseUrl: configuredBaseUrl.value || "https://auth-not-configured.invalid",
  cookies: {
    secret: configuredCookieSecret || "build-only-placeholder-secret-000000000000000000",
  },
  logLevel: "warn",
});
