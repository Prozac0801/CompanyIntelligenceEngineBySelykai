import { createNeonAuth } from "@neondatabase/auth/next/server";

const configuredBaseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
const configuredCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();

export interface AuthConfigurationHealth {
  configured: boolean;
  baseUrlConfigured: boolean;
  cookieSecretConfigured: boolean;
}

export function authConfigurationHealth(): AuthConfigurationHealth {
  const baseUrlConfigured = Boolean(configuredBaseUrl);
  const cookieSecretConfigured = Boolean(
    configuredCookieSecret && configuredCookieSecret.length >= 32,
  );

  return {
    configured: baseUrlConfigured && cookieSecretConfigured,
    baseUrlConfigured,
    cookieSecretConfigured,
  };
}

export function isAuthConfigured(): boolean {
  return authConfigurationHealth().configured;
}

// Build-safe placeholders keep CI deterministic. Every user-facing auth operation checks
// isAuthConfigured() first, so these values are never treated as a production fallback.
export const auth = createNeonAuth({
  baseUrl: configuredBaseUrl || "https://auth-not-configured.invalid",
  cookies: {
    secret: configuredCookieSecret || "build-only-placeholder-secret-000000000000000000",
  },
  logLevel: "warn",
});
