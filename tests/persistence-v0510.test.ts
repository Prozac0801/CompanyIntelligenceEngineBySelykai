import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildEstablishmentRows,
  buildEventRows,
  buildFactRows,
  buildSignalRows,
} from "@/lib/persistence/company-batch-write";
import type { CompanyEvent, CompanyFact, CompanySignal } from "@/types/intelligence";

describe("batch persistence v0.5.10", () => {
  it("normalizes establishments for a single set-based write", () => {
    expect(buildEstablishmentRows([
      { siret: "12345678900011", headOffice: true, active: true, city: "Paris" },
      { address: "sans siret" },
    ])).toEqual([
      {
        siret: "12345678900011",
        isHeadOffice: true,
        administrativeState: "active",
        nafCode: null,
        address: null,
        postalCode: null,
        city: "Paris",
        openingDate: null,
      },
    ]);
  });

  it("keeps fact payloads and provider identities intact", () => {
    const fact: CompanyFact = {
      type: "identity",
      key: "legal_name",
      value: "Selykai",
      fingerprint: "fp-1",
      evidence: {
        providerId: "recherche-entreprises",
        provider: "Recherche Entreprises",
        kind: "official",
        observedAt: "2026-08-24T10:00:00.000Z",
        confidence: 1,
      },
    };
    expect(buildFactRows([fact])[0]).toMatchObject({
      providerId: "recherche-entreprises",
      factType: "identity",
      factKey: "legal_name",
      value: "Selykai",
      fingerprint: "fp-1",
    });
  });

  it("keeps event and signal evidence arrays batchable", () => {
    const event: CompanyEvent = {
      type: "ACTIVITY_CHANGE",
      title: "Activité modifiée",
      description: "Description stable",
      observedAt: "2026-08-24T10:00:00.000Z",
      confidence: 0.9,
      evidenceKeys: ["naf_code"],
    };
    const signal: CompanySignal = {
      type: "CHANGE",
      label: "Changement",
      strength: 60,
      reason: "preuve",
      evidenceEventTypes: ["ACTIVITY_CHANGE"],
    };
    expect(buildEventRows([event], "recherche-entreprises")[0].evidenceKeys).toEqual(["naf_code"]);
    expect(buildSignalRows([signal])[0].evidenceEventTypes).toEqual(["ACTIVITY_CHANGE"]);
  });

  it("removes row-by-row SQL persistence loops from the analysis repository", () => {
    const source = readFileSync(new URL("../lib/persistence/company-repository.ts", import.meta.url), "utf8");
    expect(source).not.toContain("for (const establishment of company.establishments)");
    expect(source).not.toContain("for (const fact of facts)");
    expect(source).not.toContain("for (const event of events)");
    expect(source).not.toContain("for (const signal of signals)");
    expect(source).toContain("jsonb_to_recordset");
  });
});
