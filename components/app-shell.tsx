import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, Building2, DatabaseZap, Radar, Search, Settings2 } from "lucide-react";

const nav = [
  { label: "Recherche", icon: Search, href: "/", active: true },
  { label: "Entreprises", icon: Building2, href: "/", active: false },
  { label: "Signaux", icon: Radar, href: "/", active: false },
  { label: "Sources", icon: DatabaseZap, href: "/", active: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">S</span>
          <span>
            <strong>SELYKAI</strong>
            <small>Company Intelligence</small>
          </span>
        </Link>
        <nav className="side-nav" aria-label="Navigation principale">
          {nav.map(({ label, icon: Icon, href, active }) => (
            <Link key={label} href={href} className={active ? "active" : "disabled"} aria-disabled={!active}>
              <Icon size={18} />
              <span>{label}</span>
              {!active && <small>soon</small>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-state">
            <Activity size={17} />
            <div><strong>Engine V0.1</strong><span>Open-data mode</span></div>
          </div>
          <div className="side-footer"><Settings2 size={15} /> infrastructure prête pour Neon</div>
        </div>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
