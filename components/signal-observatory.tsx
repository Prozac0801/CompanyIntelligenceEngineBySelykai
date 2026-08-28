import type { CSSProperties } from "react";
import {
  Activity,
  ArrowUpRight,
  DatabaseZap,
  FileCheck2,
  Radar,
  ShieldCheck,
} from "lucide-react";
import type { CompanySignal, CommercialActionPolicy } from "@/types/intelligence";

interface SignalObservatoryProps {
  coveragePercent: number;
  decisionLabel: string;
  decisionReason: string;
  eventCount: number;
  factCount: number;
  policyStatus: CommercialActionPolicy["status"];
  signals: CompanySignal[];
  sourceCount: number;
}

const nodeData = [
  { id: "sources", label: "Sources", href: "#sources", icon: DatabaseZap },
  { id: "facts", label: "Faits", href: "#overview", icon: FileCheck2 },
  { id: "events", label: "Événements", href: "#timeline", icon: Activity },
  { id: "signals", label: "Signaux", href: "#signals", icon: Radar },
] as const;

function policyLabel(status: CommercialActionPolicy["status"]) {
  if (status === "allowed") return "Action autorisée";
  if (status === "blocked") return "Veille uniquement";
  return "Décision suspendue";
}

function counted(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function SignalObservatory({
  coveragePercent,
  decisionLabel,
  decisionReason,
  eventCount,
  factCount,
  policyStatus,
  signals,
  sourceCount,
}: SignalObservatoryProps) {
  const values = {
    sources: sourceCount,
    facts: factCount,
    events: eventCount,
    signals: signals.length,
  };
  const strongestSignals = [...signals].sort((a, b) => b.strength - a.strength).slice(0, 3);
  const coverageStyle = {
    "--coverage-angle": `${Math.max(0, Math.min(100, coveragePercent)) * 3.6}deg`,
  } as CSSProperties;

  return (
    <section className={`signal-observatory policy-${policyStatus}`} aria-labelledby="observatory-title">
      <header className="observatory-header">
        <div>
          <span className="observatory-live">Chaîne de preuve</span>
          <h2 id="observatory-title">Du registre à la décision</h2>
          <p>Une lecture navigable de la chaîne de preuve réellement disponible pour cette entreprise.</p>
        </div>
        <div className="observatory-policy">
          <span>Cadre commercial</span>
          <strong>{policyLabel(policyStatus)}</strong>
        </div>
      </header>

      <div className="observatory-body">
        <div
          className="observatory-map"
          role="group"
          aria-label={`${counted(sourceCount, "source", "sources")}, ${counted(factCount, "fait", "faits")}, ${counted(eventCount, "événement", "événements")} et ${counted(signals.length, "signal", "signaux")} alimentent la décision`}
        >
          <svg className="observatory-links" viewBox="0 0 640 360" preserveAspectRatio="none" aria-hidden="true">
            <path d="M100 180 C190 180 220 180 320 180" />
            <path d="M320 64 C320 105 320 128 320 180" />
            <path d="M320 296 C320 255 320 232 320 180" />
            <path d="M540 180 C450 180 420 180 320 180" />
          </svg>

          {nodeData.map(({ id, label, href, icon: Icon }) => (
            <a className={`observatory-node node-${id}`} href={href} key={id}>
              <span><Icon size={16} aria-hidden="true" /></span>
              <strong>{values[id]}</strong>
              <small>{label}</small>
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          ))}

          <a className="observatory-core" href="#overview" style={coverageStyle}>
            <span className="observatory-core-ring" aria-hidden="true"><ShieldCheck size={18} /></span>
            <small>Décision</small>
            <strong>{decisionLabel}</strong>
            <em>{coveragePercent}% de couverture</em>
          </a>
        </div>

        <div className="observatory-readout">
          <div className="observatory-decision-copy">
            <span>Lecture du moteur</span>
            <strong>{decisionLabel}</strong>
            <p>{decisionReason}</p>
          </div>

          <div className="observatory-signal-list">
            <div className="observatory-signal-title"><Radar size={15} aria-hidden="true" /><span>Signaux dominants</span></div>
            {strongestSignals.length ? strongestSignals.map((signal) => (
              <a href="#signals" key={`${signal.type}-${signal.label}`}>
                <span><strong>{signal.label}</strong><small>{signal.type}</small></span>
                <span className="observatory-strength" role="meter" aria-label={`Force ${signal.strength} sur 100`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={signal.strength}>
                  <i style={{ width: `${signal.strength}%` }} />
                </span>
                <b>{signal.strength}</b>
              </a>
            )) : (
              <p>Aucun signal différentiel suffisamment fiable. Le moteur conserve un état de veille.</p>
            )}
          </div>

          <div className="observatory-principle"><ShieldPrinciple /><span>Les faits alimentent le graphe. Les inférences restent identifiées et explicables.</span></div>
        </div>
      </div>
    </section>
  );
}

function ShieldPrinciple() {
  return <FileCheck2 size={16} aria-hidden="true" />;
}
