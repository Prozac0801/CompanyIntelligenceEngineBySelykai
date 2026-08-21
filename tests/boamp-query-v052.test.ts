import { describe, expect, it } from "vitest";
import { buildBoampWhereClause } from "@/lib/providers/boamp";

describe("BOAMP ODSQL V0.5.2", () => {
  it("uses a typed ODSQL date literal for the rolling lookback", () => {
    const now = new Date("2026-08-21T10:00:00.000Z").getTime();
    const where = buildBoampWhereClause("ANAVEO", now);

    expect(where).toBe(`search(titulaire, "ANAVEO") and dateparution >= date'2025-02-17'`);
    expect(where).not.toContain('dateparution >= "2025-02-17"');
  });

  it("escapes quotes and backslashes in company names before building ODSQL", () => {
    const now = new Date("2026-08-21T10:00:00.000Z").getTime();
    const where = buildBoampWhereClause('ACME "SECURITY" \\ FRANCE', now);

    expect(where).toContain('search(titulaire, "ACME \\"SECURITY\\" \\\\ FRANCE")');
    expect(where).toContain("dateparution >= date'2025-02-17'");
  });
});
