"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signInWithEmail } from "@/app/auth/actions";

export function SignInForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(signInWithEmail, null);

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <div className="auth-error" role="alert">{state.error}</div>}
      <button type="submit" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}<ArrowRight size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
