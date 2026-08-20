import { AppShell } from "@/components/app-shell";
import { SearchCommand } from "@/components/search-command";
import { SourceRail } from "@/components/source-rail";

export default function HomePage() {
  return (
    <AppShell>
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <p className="context-line">Selykai Company Intelligence Engine</p>
            <h1>Comprendre une entreprise<br />avant de la contacter.</h1>
            <p className="lead">Une recherche unique, des sources traçables, puis des signaux expliqués. Le moteur sépare strictement les faits collectés des déductions.</p>
          </div>
          <div className="build-tag"><span /> build foundation</div>
        </header>
        <SearchCommand />
        <SourceRail />
      </div>
    </AppShell>
  );
}
