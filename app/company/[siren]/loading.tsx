import { DatabaseZap, Globe2, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const steps = [
  ["Registre officiel", "Identité · SIREN · établissements"],
  ["INPI / RNE", "Recoupement juridique et faits RNE"],
  ["Hunter", "Domaine · firmographie · technologies"],
  ["APILayer", "SERP · actualités · géolocalisation"],
  ["Selykai Engine", "Signaux · scoring · historisation"],
] as const;

export default function CompanyLoading() {
  return (
    <AppShell>
      <div className="workspace company-analysis-loading" role="status" aria-live="polite">
        <div className="analysis-loader-hero">
          <div className="analysis-radar">
            <div className="analysis-ring ring-a" />
            <div className="analysis-ring ring-b" />
            <div className="analysis-sweep" />
            <div className="analysis-core"><Radar size={26} /></div>
            <span className="analysis-node node-a" />
            <span className="analysis-node node-b" />
            <span className="analysis-node node-c" />
          </div>
          <div>
            <p className="context-line"><Sparkles size={14} /> COMPANY INTELLIGENCE ENGINE</p>
            <h1>Analyse multi-source en cours</h1>
            <p className="lead">Le moteur recoupe les faits officiels, enrichit la présence web puis calcule les signaux sans mélanger faits et inférences.</p>
          </div>
        </div>

        <div className="analysis-step-grid">
          {steps.map(([title, detail], index) => (
            <div className="analysis-step" key={title} style={{ animationDelay: `${index * 120}ms` }}>
              <span>{index === 0 ? <ShieldCheck size={17} /> : index < 4 ? <Globe2 size={17} /> : <DatabaseZap size={17} />}</span>
              <div><strong>{title}</strong><small>{detail}</small></div>
              <i />
            </div>
          ))}
        </div>

        <div className="analysis-skeleton-grid">
          <div className="analysis-skeleton wide"><span /><span /><span /></div>
          <div className="analysis-skeleton score"><span /><span /></div>
          <div className="analysis-skeleton"><span /><span /><span /></div>
          <div className="analysis-skeleton"><span /><span /><span /></div>
        </div>
      </div>
    </AppShell>
  );
}
