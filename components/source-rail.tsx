import { CheckCircle2, CircleDashed, Database, KeyRound, ShieldCheck } from "lucide-react";
import { hasDatabase } from "@/lib/db";
import { getProviderCatalog, type ProviderStatus } from "@/lib/providers/catalog";

const STATUS_LABEL: Record<ProviderStatus, string> = {
  live: "Disponible",
  configured: "Configuré",
  next: "Planifié",
};

function StatusIcon({ status }: { status: ProviderStatus }) {
  if (status === "live") return <CheckCircle2 size={17} aria-hidden="true" />;
  if (status === "configured") return <KeyRound size={16} aria-hidden="true" />;
  return <CircleDashed size={17} aria-hidden="true" />;
}

export function SourceRail() {
  const sources = getProviderCatalog();
  const databaseConfigured = hasDatabase();

  return (
    <section className="source-section" id="sources-pipeline">
      <div className="section-heading">
        <div><span className="section-icon"><ShieldCheck size={19} aria-hidden="true" /></span><span><small>Sources et provenance</small><h2>Un socle de données vérifiables</h2></span></div>
        <p>Chaque donnée conserve sa preuve, son horodatage et son niveau de confiance.</p>
      </div>
      <div className="source-rail">
        {sources.map((source) => (
          <article className="source-item" key={source.id}>
            <div className={`source-state ${source.status}`}><Database size={18} aria-hidden="true" /></div>
            <div className="source-copy"><strong>{source.name}</strong><span>{source.role}</span></div>
            <span className={`source-badge ${source.status}`}><StatusIcon status={source.status} /> {STATUS_LABEL[source.status]}</span>
          </article>
        ))}
      </div>
      <div className="architecture-note">
        <Database size={16} aria-hidden="true" />
        {databaseConfigured
          ? "Neon connecté : faits, snapshots, événements et scores peuvent être historisés."
          : "Mode lecture live : la recherche fonctionne, mais l’historisation Neon est inactive."}
      </div>
    </section>
  );
}
