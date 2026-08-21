import { DatabaseZap, FileSearch, Globe2, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const steps = [
  ["Registre officiel", "Identité · SIREN · établissements", "official"],
  ["INPI / RNE", "Recoupement juridique et implantations", "official"],
  ["BODACC / DILA", "Annonces · modifications · procédures · comptes", "legal"],
  ["BOAMP / DILA", "Marchés publics attribués · activité commerciale", "official"],
  ["Web officiel", "Domaine · recrutements · surface carrière", "web"],
  ["Hunter", "Firmographie · technologies sur domaine recoupé", "web"],
  ["Selykai Engine", "Fit · Momentum · Access · Risk · Confidence", "engine"],
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
            <p className="context-line"><Sparkles size={14} /> COMPANY INTELLIGENCE ENGINE V0.5</p>
            <h1>Détection des déclencheurs business</h1>
            <p className="lead">Le moteur recoupe identité, événements juridiques, marchés publics, recrutements, implantations, finance et présence web avant de calculer Fit, Momentum, Access, Risk et confiance.</p>
          </div>
        </div>

        <div className="analysis-step-grid">
          {steps.map(([title, detail, kind], index) => {
            const Icon = kind === "official" ? ShieldCheck : kind === "legal" ? FileSearch : kind === "engine" ? DatabaseZap : Globe2;
            return (
              <div className="analysis-step" key={title} style={{ animationDelay: `${index * 110}ms` }}>
                <span><Icon size={17} /></span>
                <div><strong>{title}</strong><small>{detail}</small></div>
                <i />
              </div>
            );
          })}
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
