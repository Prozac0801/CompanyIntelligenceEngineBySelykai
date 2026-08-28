"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DatabaseZap, Radar, Search } from "lucide-react";

const nav = [
  { label: "Recherche", description: "Explorer", icon: Search, href: "/" },
  { label: "Veille", description: "Surveiller", icon: Radar, href: "/workspace" },
  { label: "Sources", description: "Vérifier", icon: DatabaseZap, href: "/#sources-pipeline" },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label="Navigation principale">
      {nav.map(({ label, description, icon: Icon, href }) => {
        const active = href === "/"
          ? pathname === "/" || pathname.startsWith("/company/")
          : href === "/workspace" && pathname.startsWith("/workspace");
        return (
          <Link key={label} href={href} aria-current={active ? "page" : undefined}>
            <span className="nav-icon"><Icon size={18} aria-hidden="true" /></span>
            <span className="nav-copy"><strong>{label}</strong><small>{description}</small></span>
            {active ? <span className="nav-active-dot" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
