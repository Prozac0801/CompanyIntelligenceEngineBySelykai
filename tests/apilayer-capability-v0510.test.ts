import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capability = vi.hoisted(() => ({
  open: vi.fn(async () => undefined),
  record: vi.fn(async () => undefined),
}));

vi.mock("@/lib/providers/capability-state", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/providers/capability-state")>();
  return {
    ...original,
    openCapabilityCircuit: capability.open,
    readCapabilityState: vi.fn(async () => null),
    recordCapabilityHttpResult: capability.record,
  };
});

import { getCompanyNews } from "@/lib/providers/apilayer";

describe("APILayer capability lifecycle v0.5.10", () => {
  const previousKey = process.env.APILAYER_API_KEY;

  beforeEach(() => {
    process.env.APILAYER_API_KEY = "test-key";
    capability.open.mockClear();
    capability.record.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.APILAYER_API_KEY;
    else process.env.APILAYER_API_KEY = previousKey;
  });

  it("closes the capability circuit after a valid successful response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: [{
        title: "Selykai lance une nouvelle solution",
        description: "Actualité Selykai",
        url: "https://example.com/selykai",
      }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    const result = await getCompanyNews("Selykai");

    expect(result.news).toHaveLength(1);
    expect(capability.record).toHaveBeenCalledWith("apilayer-news", 200);
    expect(capability.open).not.toHaveBeenCalled();
  });

  it("opens a degraded circuit when a successful HTTP response is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));

    const result = await getCompanyNews("Selykai");

    expect(result.news).toEqual([]);
    expect(capability.record).not.toHaveBeenCalled();
    expect(capability.open).toHaveBeenCalledWith("apilayer-news", "degraded");
  });

  it("does not mark a JSON error envelope as a healthy capability", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: false,
      error: { code: 105, type: "https_access_restricted" },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    const result = await getCompanyNews("Selykai");

    expect(result.news).toEqual([]);
    expect(capability.record).not.toHaveBeenCalled();
    expect(capability.open).toHaveBeenCalledWith("apilayer-news", "degraded");
  });
});
