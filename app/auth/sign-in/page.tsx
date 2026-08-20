"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { signInWithEmail } from "@/app/auth/actions";

export default function SignInPage() {
  const [state, action, pending] = useActionState(signInWithEmail, null);

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><span>S</span><strong>SELYKAI</strong></Link>
        <div className="auth-copy">
          <p className="mono">COMPANY INTELLIGENCE ENGINE</p>
          <h1>Reprendre votre veille entreprise.</h1>
          <p>Accédez à vos listes surveillées, aux changements détectés et aux alertes de vos équipes.</p>
        </div>
        <form action={action} className="auth-form">
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label>
          {state?.error && <div className="auth-error">{state.error}</div>}
          <button type="submit" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}<ArrowRight size={16} /></button>
        </form>
        <div className="auth-footer"><ShieldCheck size={14} /> Session sécurisée par Neon Auth</div>
        <p className="auth-switch">Pas encore de compte ? <Link href="/auth/sign-up">Créer un accès</Link></p>
      </section>
    </main>
  );
}
