"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { signUpWithEmail } from "@/app/auth/actions";

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUpWithEmail, null);

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><span>S</span><strong>SELYKAI</strong></Link>
        <div className="auth-copy">
          <p className="mono">COMPANY INTELLIGENCE ENGINE</p>
          <h1>Créer votre espace de veille.</h1>
          <p>Un espace personnel et une première watchlist seront créés automatiquement après inscription.</p>
        </div>
        <form action={action} className="auth-form">
          <label>Nom<input name="name" type="text" autoComplete="name" required /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Mot de passe<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          {state?.error && <div className="auth-error">{state.error}</div>}
          <button type="submit" disabled={pending}>{pending ? "Création…" : "Créer mon espace"}<ArrowRight size={16} /></button>
        </form>
        <div className="auth-footer"><ShieldCheck size={14} /> Authentification gérée par Neon</div>
        <p className="auth-switch">Déjà inscrit ? <Link href="/auth/sign-in">Se connecter</Link></p>
      </section>
    </main>
  );
}
