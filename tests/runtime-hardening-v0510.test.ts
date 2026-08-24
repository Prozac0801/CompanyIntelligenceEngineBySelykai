import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { latestRequestWins } from "@/lib/search/request-order";

describe("v0.5.10 runtime hardening", () => {
  it("pins Vercel functions to Frankfurt without losing the monitoring cron", () => {
    const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
      regions?: string[];
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.regions).toEqual(["fra1"]);
    expect(config.crons).toContainEqual({ path: "/api/internal/monitor", schedule: "0 5 * * *" });
  });

  it("allows only the latest search request to publish results", () => {
    expect(latestRequestWins(2, 2)).toBe(true);
    expect(latestRequestWins(1, 2)).toBe(false);
    expect(latestRequestWins(3, 2)).toBe(false);
  });

  it("does not keep the old artificial 720 ms search floor", () => {
    const source = readFileSync(new URL("../components/search-command.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("720");
    expect(source).not.toContain("sleep(");
    expect(source).toContain("AbortController");
  });
});
