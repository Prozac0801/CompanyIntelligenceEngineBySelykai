import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return <AppShell><div className="workspace"><div className="not-found"><span className="mono">404</span><h1>Entreprise introuvable.</h1><p>Le SIREN est invalide, non diffusible ou absent de la source actuellement connectée.</p><Link href="/">Retour à la recherche</Link></div></div></AppShell>;
}
