import { describe, expect, it, vi } from "vitest";
import { deferProviderRun } from "@/lib/providers/observability";

describe("provider observability v0.5.10", () => {
  it("schedules persistence without blocking when after() is available", async () => {
    const persist = vi.fn(async () => undefined);
    let scheduled: (() => Promise<void>) | undefined;
    const schedule = vi.fn((task: () => Promise<void>) => {
      scheduled = task;
    });

    await deferProviderRun(persist, schedule);
    expect(persist).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledTimes(1);

    await scheduled?.();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("falls back to synchronous persistence outside a request lifecycle", async () => {
    const persist = vi.fn(async () => undefined);
    const schedule = vi.fn(() => {
      throw new Error("after unavailable");
    });

    await deferProviderRun(persist, schedule);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
