import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("premium UI system v0.5.10", () => {
  it("loads the optimized product font and the premium layer from the root layout", () => {
    const layout = source("app/layout.tsx");
    expect(layout).toContain("Plus_Jakarta_Sans");
    expect(layout).toContain('import "./premium-ui.css"');
    expect(layout.indexOf('import "./premium-ui.css"')).toBeGreaterThan(
      layout.indexOf('import "./intelligence-v041.css"'),
    );
  });

  it("keeps the server shell small while isolating pathname state in the navigation", () => {
    const shell = source("components/app-shell.tsx");
    const navigation = source("components/primary-nav.tsx");
    expect(shell).not.toContain('"use client"');
    expect(shell).toContain("PrimaryNav");
    expect(shell).toContain("CommandPalette");
    expect(shell).toContain("skip-link");
    expect(navigation).toContain('"use client"');
    expect(navigation).toContain("usePathname");
    expect(navigation).toContain('aria-current={active ? "page" : undefined}');
  });

  it("keeps keyboard, motion and responsive safeguards in the visual system", () => {
    const css = source("app/premium-ui.css");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("@media (max-width: 680px)");
    expect(css).toContain("@media (max-width: 460px)");
  });

  it("announces asynchronous search state and visible errors", () => {
    const search = source("components/search-command.tsx");
    expect(search).toContain("aria-busy={loading}");
    expect(search).toContain('role="status"');
    expect(search).toContain('role="alert"');
    expect(search).toContain('aria-keyshortcuts="/ ArrowDown"');
    expect(search).toContain("prefetch={false}");
  });

  it("provides a global native command palette without eager company analysis", () => {
    const palette = source("components/command-palette.tsx");
    expect(palette).toContain("<dialog");
    expect(palette).toContain('event.key.toLowerCase() === "k"');
    expect(palette).toContain("prefetch={false}");
    expect(palette).toContain('aria-haspopup="dialog"');
  });

  it("renders a decision graph from real analysis counts", () => {
    const companyPage = source("app/company/[siren]/page.tsx");
    const observatory = source("components/signal-observatory.tsx");
    expect(companyPage).toContain("<SignalObservatory");
    expect(companyPage).toContain("sourceCount={sourceEvidence.length}");
    expect(companyPage).toContain("eventCount={timeline.length + enrichment.legalEvents.length}");
    expect(observatory).toContain("strongestSignals");
    expect(observatory).toContain("--coverage-angle");
  });

  it("keeps the active premium layer free from decorative grid and side-tab tells", () => {
    const css = source("app/premium-ui.css");
    expect(css).not.toContain("border-left: 3px");
    expect(css).not.toContain("background-size: 28px 28px");
  });
});
