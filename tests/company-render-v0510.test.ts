import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("company render hardening v0.5.10", () => {
  it("keeps optional authenticated watch context behind Suspense", () => {
    const layout = readFileSync(new URL("../app/company/[siren]/layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain("Suspense");
    expect(layout).toContain("CompanyWatchDock");
    expect(layout).not.toContain("auth.getSession");
    expect(layout).not.toContain("listUserWorkspaces");
  });

  it("starts analysis and timeline work in parallel", () => {
    const page = readFileSync(new URL("../app/company/[siren]/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("Promise.all");
    expect(page).toContain("loadCompanyTimeline");
  });
});
