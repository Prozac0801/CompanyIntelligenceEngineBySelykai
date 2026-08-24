"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signUpWithEmail } from "@/app/auth/actions";

export function SignUpForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(signUpWithEmail, null);

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Nom<input name="name" type="text" autoComplete="name" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      {state?.error && <div className="auth-error">{state.error}</div>}
      <button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer mon espace"}<ArrowRight size={16} />
      </button>
    </form>
  );
}
