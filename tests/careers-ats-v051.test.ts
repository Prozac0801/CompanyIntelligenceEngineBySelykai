import { describe, expect, it } from "vitest";
import { parseHiringPageSnapshot } from "@/lib/providers/careers";

const NOW = new Date("2026-08-21T10:00:00.000Z").getTime();

describe("Momentum hiring evidence", () => {
  it("reads an explicit active-offer count and representative job titles from a verified ATS page", () => {
    const html = `
      <html><body>
        <h1>Anaveo Recrutement</h1>
        <p>23 offres d'emploi chez Anaveo</p>
        <a href="/anaveo/offre/1">Chargé d'Installation et de Maintenance - Dpt 69 - 01 H/F</a>
        <a href="/anaveo/offre/2">Ingénieur Commercial Grands Comptes - IDF H/F</a>
        <a href="/anaveo/list">Voir toutes les offres</a>
      </body></html>`;

    const snapshot = parseHiringPageSnapshot(
      html,
      "https://www.talentdetection.com/anaveo/65410-ASRLQ9K6Qe/list",
      NOW,
    );

    expect(snapshot.activeOpeningCount).toBe(23);
    expect(snapshot.jobTitles).toEqual(expect.arrayContaining([
      "Chargé d'Installation et de Maintenance - Dpt 69 - 01 H/F",
      "Ingénieur Commercial Grands Comptes - IDF H/F",
    ]));
  });

  it("does not turn generic apply links into a numeric hiring signal", () => {
    const html = `
      <html><body>
        <h1>Nous rejoindre</h1>
        <p>Découvrez notre équipe et nos métiers.</p>
        <a href="/jobs/apply">Postuler</a>
        <a href="/jobs/candidature-spontanee">Candidater</a>
      </body></html>`;

    const snapshot = parseHiringPageSnapshot(html, "https://example.com/carrieres", NOW);
    expect(snapshot.activeOpeningCount).toBeUndefined();
    expect(snapshot.jobTitles).toEqual([]);
  });

  it("accepts specific first-party job titles as concrete openings", () => {
    const html = `
      <html><body>
        <h1>Carrières</h1>
        <a href="/offres/technicien-lyon">Technicien sécurité électronique H/F</a>
        <a href="/offres/chef-projet">Chef de projet sûreté H/F</a>
      </body></html>`;

    const snapshot = parseHiringPageSnapshot(html, "https://example.com/carrieres", NOW);
    expect(snapshot.activeOpeningCount).toBe(2);
    expect(snapshot.jobTitles).toHaveLength(2);
  });
});
