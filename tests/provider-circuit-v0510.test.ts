import { describe, expect, it } from "vitest";
import {
  capabilityAllowsRequest,
  capabilityCacheKey,
  capabilityStateFromHttp,
} from "@/lib/providers/capability-state";
import { getProviderCatalog } from "@/lib/providers/catalog";

describe("provider capability circuits v0.5.10", () => {
  const now = Date.parse("2026-08-24T10:00:00.000Z");

  it("opens a one-hour circuit after authentication failure", () => {
    const state = capabilityStateFromHttp("apilayer-news", 401, now);
    expect(state.status).toBe("auth_error");
    expect(state.retryAfter).toBe(new Date(now + 60 * 60 * 1000).toISOString());
    expect(capabilityAllowsRequest(state, now + 30 * 60 * 1000)).toBe(false);
    expect(capabilityAllowsRequest(state, now + 60 * 60 * 1000 + 1)).toBe(true);
  });

  it("keeps capability circuits isolated by product", () => {
    expect(capabilityCacheKey("apilayer-serp")).not.toBe(capabilityCacheKey("apilayer-news"));
    const serp = capabilityStateFromHttp("apilayer-serp", 200, now);
    const news = capabilityStateFromHttp("apilayer-news", 403, now);
    expect(capabilityAllowsRequest(serp, now)).toBe(true);
    expect(capabilityAllowsRequest(news, now)).toBe(false);
  });

  it("backs off rate limits without treating them as auth failures", () => {
    const state = capabilityStateFromHttp("apilayer-geo", 429, now);
    expect(state.status).toBe("rate_limited");
    expect(capabilityAllowsRequest(state, now + 60_000)).toBe(false);
    expect(capabilityAllowsRequest(state, now + 5 * 60 * 1000 + 1)).toBe(true);
  });

  it("does not claim the whole APILayer family is live merely because a key exists", () => {
    const previous = process.env.APILAYER_API_KEY;
    process.env.APILAYER_API_KEY = "configured-for-test";
    try {
      expect(getProviderCatalog().find((provider) => provider.id === "apilayer")?.status).toBe("configured");
    } finally {
      if (previous === undefined) delete process.env.APILAYER_API_KEY;
      else process.env.APILAYER_API_KEY = previous;
    }
  });
});
