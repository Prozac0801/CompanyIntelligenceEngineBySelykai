import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignalObservatory } from "@/components/signal-observatory";

describe("signal observatory v0.5.10", () => {
  it("renders an accessible decision graph from real counts and strengths", () => {
    const markup = renderToStaticMarkup(createElement(SignalObservatory, {
      coveragePercent: 78,
      decisionLabel: "Déclencheur détecté",
      decisionReason: "Deux événements récents alimentent la décision.",
      eventCount: 6,
      factCount: 14,
      policyStatus: "allowed",
      signals: [
        {
          type: "EXPANSION",
          label: "Ouverture d’établissement",
          strength: 82,
          reason: "Nouvelle implantation officielle",
          evidenceEventTypes: ["ESTABLISHMENT_OPENING"],
        },
      ],
      sourceCount: 4,
    }));

    expect(markup).toContain("Du registre à la décision");
    expect(markup).toContain("4 sources, 14 faits, 6 événements et 1 signal");
    expect(markup).toContain('role="meter"');
    expect(markup).toContain('aria-valuenow="82"');
    expect(markup).toContain("78% de couverture");
  });
});
