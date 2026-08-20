import { CheckCircle2, CircleDashed, Database, KeyRound, ScanSearch } from "lucide-react";
import { hasDatabase } from "@/lib/db";
import { getProviderCatalog, type ProviderStatus } from "@/lib/providers/catalog";

const STATUS_LABEL: Record<ProviderStatus, string> = {
  live: "LIVE",
  configured: "CONFIGURÉ",
  next: "NEXT",
};

function StatusIcon({ status }: { status: ProviderStatus }) {
  if (status === "live") return <CheckCircle2 size={17} />;
  if (status === "configured") return <KeyRound size={16} />;
  return <CircleDashed size={17} />;
}

export function SourceRail() {
  const sources = getProviderCatalog();
  const databaseConfigured = hasDatabase();

  return (
    <section className="source-section">
      <div className="section-heading">
        <div><ScanSearch size={20} /><span>Pipeline de sources</span></div>
        <small>Chaque donnée garde sa preuve et sa date d’observation.</small>
      </div>
      <div className="source-rail">
        {sources.map((source) => (
          <div className="source-item" key={source.id}>
            <div className={`source-state ${source.status}`}>
              <StatusIcon status={source.status} />
            </div>
            <div><strong>{source.name}</strong><span>{source.role}</span></div>
            <small>{STATUS_LABEL[source.status]}</small>
          </div>
        ))}
      </div>
      <div className="architecture-note">
        <Database size={16} />
        {databaseConfigured
          ? "Neon connecté : faits, snapshots, événements et scores peuvent être historisés."
          : "Mode lecture live : la recherche fonctionne, mais l’historisation Neon est inactive."}
      </div>
    </section>
  );
}
