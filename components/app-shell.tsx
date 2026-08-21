import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, DatabaseZap, Radar, Search, Settings2 } from "lucide-react";

const nav = [
  { label: "Recherche", icon: Search, href: "/", enabled: true },
  { label: "Veille", icon: Radar, href: "/workspace", enabled: true },
  { label: "Sources", icon: DatabaseZap, href: "/", enabled: false },
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
          {nav.map(({ label, icon: Icon, href, enabled }) => (
            <Link key={label} href={enabled ? href : "/"} className={enabled ? "" : "disabled"} aria-disabled={!enabled}>
              <Icon size={18} />
              <span>{label}</span>
              {!enabled && <small>soon</small>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-state">
            <Activity size={17} />
            <div><strong>Engine V0.5</strong><span>official · momentum · corroborated web</span></div>
          </div>
          <div className="side-footer"><Settings2 size={15} /> facts · triggers · risk · confidence</div>
        </div>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
