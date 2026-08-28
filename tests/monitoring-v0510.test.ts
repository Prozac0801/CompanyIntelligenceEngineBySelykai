import { describe, expect, it } from "vitest";
import {
  mapWithConcurrency,
  monitoringFailureDelayMinutes,
  normalizeMonitoringConcurrency,
} from "@/lib/monitoring/concurrency";

describe("monitoring hardening v0.5.10", () => {
  it("defaults to two workers and caps configuration at four", () => {
    expect(normalizeMonitoringConcurrency(undefined)).toBe(2);
    expect(normalizeMonitoringConcurrency("0")).toBe(1);
    expect(normalizeMonitoringConcurrency("3")).toBe(3);
    expect(normalizeMonitoringConcurrency("99")).toBe(4);
    expect(normalizeMonitoringConcurrency("oops")).toBe(2);
  });

  it("uses a long retry window for companies that cannot be found", () => {
    expect(monitoringFailureDelayMinutes("Entreprise introuvable pendant la surveillance.")).toBe(7 * 24 * 60);
    expect(monitoringFailureDelayMinutes("upstream_error")).toBe(60);
  });

  it("never exceeds the requested concurrency", async () => {
    let active = 0;
    let maximum = 0;
    const values = [1, 2, 3, 4, 5, 6];
    const results = await mapWithConcurrency(values, 2, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value * 2;
    });

    expect(maximum).toBe(2);
    expect(results).toEqual([2, 4, 6, 8, 10, 12]);
  });
});
