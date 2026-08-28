import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, Radar, ShieldCheck } from "lucide-react";
import { SelykaiMark } from "@/components/selykai-mark";

interface AuthShellProps {
  children: ReactNode;
  description: string;
  eyebrow: string;
  footer: string;
  switchHref: string;
  switchLabel: string;
  switchText: string;
  title: string;
}

export function AuthShell({
  children,
  description,
  eyebrow,
  footer,
  switchHref,
  switchLabel,
  switchText,
  title,
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <aside className="auth-showcase">
          <Link href="/" className="auth-brand">
            <span><SelykaiMark /></span>
            <strong>SELYKAI</strong>
            <small>INTELLIGENCE ENGINE</small>
          </Link>
          <div className="auth-showcase-copy">
            <p>Intelligence entreprise</p>
            <p className="auth-showcase-title">Décider sur des faits vérifiables.</p>
            <span>Un espace sécurisé pour suivre les entreprises, documenter les changements et prioriser les décisions.</span>
          </div>
          <div className="auth-capabilities" aria-label="Capacités de la plateforme">
            <div><ShieldCheck size={18} aria-hidden="true" /><span><strong>Faits sourcés</strong><small>Provenance conservée</small></span></div>
            <div><Radar size={18} aria-hidden="true" /><span><strong>Veille ciblée</strong><small>Changements détectés</small></span></div>
            <div><Activity size={18} aria-hidden="true" /><span><strong>Score explicable</strong><small>Aucune boîte noire</small></span></div>
          </div>
          <div className="auth-showcase-status"><i /> Infrastructure européenne opérationnelle</div>
        </aside>

        <section className="auth-panel">
          <div className="auth-copy">
            <p className="mono">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
          <div className="auth-footer"><ShieldCheck size={14} aria-hidden="true" /> {footer}</div>
          <p className="auth-switch">{switchText} <Link href={switchHref}>{switchLabel}</Link></p>
        </section>
      </div>
    </main>
  );
}
