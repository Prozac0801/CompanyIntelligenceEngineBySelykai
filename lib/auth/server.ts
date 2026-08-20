import { createNeonAuth } from "@neondatabase/auth/next/server";

const configuredBaseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
const configuredCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();

export function isAuthConfigured(): boolean {
  return Boolean(configuredBaseUrl && configuredCookieSecret && configuredCookieSecret.length >= 32);
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
