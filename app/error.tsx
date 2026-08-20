"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="fatal-state">
      <AlertTriangle size={28} />
      <span className="mono">SOURCE / RUNTIME ERROR</span>
      <h1>Le moteur n’a pas pu terminer cette analyse.</h1>
      <p>La source distante peut être indisponible ou limitée temporairement. Aucune donnée non vérifiée n’est inventée en remplacement.</p>
      <button type="button" onClick={reset}><RotateCcw size={16} /> Réessayer</button>
    </main>
  );
}
