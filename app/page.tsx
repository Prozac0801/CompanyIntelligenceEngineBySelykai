import { AppShell } from "@/components/app-shell";
import { SearchCommand } from "@/components/search-command";
import { SourceRail } from "@/components/source-rail";
import { ArrowRight, Database, FileCheck2, ShieldCheck, Target } from "lucide-react";

export default function HomePage() {
  return (
    <AppShell>
      <div className="workspace home-workspace">
        <header className="workspace-header premium-hero">
          <div className="hero-copy">
            <p className="context-line"><span /> Intelligence entreprise · France</p>
            <h1>Comprendre l’entreprise.<br /><span>Agir au bon moment.</span></h1>
            <p className="lead">Selykai consolide les sources officielles, distingue les faits des inférences et met en évidence les signaux qui justifient une décision.</p>
            <div className="hero-proof-list" aria-label="Principes du moteur">
              <span><Database size={15} aria-hidden="true" /> Sources officielles</span>
              <span><FileCheck2 size={15} aria-hidden="true" /> Provenance conservée</span>
              <span><ShieldCheck size={15} aria-hidden="true" /> Inférences identifiées</span>
            </div>
          </div>
          <aside className="hero-system-card" aria-label="Architecture du moteur d’intelligence">
            <div className="hero-system-head">
              <span><i /> Plateforme opérationnelle</span>
              <b>France · UE</b>
            </div>
            <div className="hero-system-summary">
              <span>Cadre d’analyse</span>
              <h2>Une décision reliée à ses preuves.</h2>
              <p>Le moteur documente ce qu’il sait, ce qu’il déduit et ce qui reste à confirmer.</p>
            </div>
            <div className="hero-flow">
              <div><Database size={17} aria-hidden="true" /><span><small>Sources</small><strong>Registres et publications officielles</strong></span><b>01</b></div>
              <div><FileCheck2 size={17} aria-hidden="true" /><span><small>Analyse</small><strong>Faits, événements et signaux séparés</strong></span><b>02</b></div>
              <div><Target size={17} aria-hidden="true" /><span><small>Décision</small><strong>Priorité et prochaine action explicables</strong></span><b>03</b></div>
            </div>
            <div className="hero-system-assurance"><ShieldCheck size={16} aria-hidden="true" /><span>Traçabilité intégrale de la source à la recommandation</span><ArrowRight size={16} aria-hidden="true" /></div>
          </aside>
        </header>
        <SearchCommand />
        <SourceRail />
      </div>
    </AppShell>
  );
}
