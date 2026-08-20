import { CheckCircle2, CircleDashed, Database, ScanSearch } from "lucide-react";

const sources = [
  { name: "API Recherche d'entreprises", role: "Identité · SIREN · établissements", state: "live" },
  { name: "INPI / RNE", role: "Événements · actes · comptes", state: "next" },
  { name: "APILayer", role: "Web · email · géolocalisation · news", state: "next" },
  { name: "Hunter", role: "Contacts professionnels à la demande", state: "next" },
];

export function SourceRail() {
  return (
    <section className="source-section">
      <div className="section-heading">
        <div><ScanSearch size={20} /><span>Pipeline de sources</span></div>
        <small>Chaque donnée garde sa preuve et sa date d’observation.</small>
      </div>
      <div className="source-rail">
        {sources.map((source) => (
          <div className="source-item" key={source.name}>
            <div className={`source-state ${source.state}`}>
              {source.state === "live" ? <CheckCircle2 size={17} /> : <CircleDashed size={17} />}
            </div>
            <div><strong>{source.name}</strong><span>{source.role}</span></div>
            <small>{source.state === "live" ? "LIVE" : "NEXT"}</small>
          </div>
        ))}
      </div>
      <div className="architecture-note"><Database size={16} /> Neon sera ajouté après validation Git : aucune dépendance BDD n’est nécessaire pour tester la recherche live.</div>
    </section>
  );
}
