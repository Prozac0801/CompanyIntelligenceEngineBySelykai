import { CheckCircle2, CircleDashed, Database, ScanSearch } from "lucide-react";
import { PROVIDER_CATALOG } from "@/lib/providers/catalog";

export function SourceRail() {
  return (
    <section className="source-section">
      <div className="section-heading">
        <div><ScanSearch size={20} /><span>Pipeline de sources</span></div>
        <small>Chaque donnée garde sa preuve et sa date d’observation.</small>
      </div>
      <div className="source-rail">
        {PROVIDER_CATALOG.map((source) => (
          <div className="source-item" key={source.id}>
            <div className={`source-state ${source.status}`}>
              {source.status === "live" ? <CheckCircle2 size={17} /> : <CircleDashed size={17} />}
            </div>
            <div><strong>{source.name}</strong><span>{source.role}</span></div>
            <small>{source.status === "live" ? "LIVE" : "NEXT"}</small>
          </div>
        ))}
      </div>
      <div className="architecture-note"><Database size={16} /> Neon sera ajouté après validation Git : aucune dépendance BDD n’est nécessaire pour tester la recherche live.</div>
    </section>
  );
}
