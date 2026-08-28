import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, ShieldCheck } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { PrimaryNav } from "@/components/primary-nav";
import { SelykaiMark } from "@/components/selykai-mark";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Aller au contenu</a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark"><SelykaiMark /></span>
          <span className="brand-copy">
            <strong>SELYKAI</strong>
            <small>Company Intelligence</small>
          </span>
        </Link>
        <div className="sidebar-navigation">
          <CommandPalette />
          <p className="nav-section-label">Espace de travail</p>
          <PrimaryNav />
        </div>
        <div className="sidebar-bottom">
          <div className="runtime-label"><span /> Système opérationnel</div>
          <div className="engine-state">
            <Activity size={17} aria-hidden="true" />
            <div><strong>Analyse multi-source</strong><span>Surveillance et décision explicable</span></div>
          </div>
          <div className="side-footer"><ShieldCheck size={15} aria-hidden="true" /> Sources vérifiées · données traçables</div>
        </div>
      </aside>
      <main className="main-panel" id="main-content">{children}</main>
    </div>
  );
}
