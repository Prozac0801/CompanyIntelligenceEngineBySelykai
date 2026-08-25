import { AuthShell } from "@/components/auth-shell";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { SignUpForm } from "./sign-up-form";

function firstValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  const returnTo = sanitizeReturnTo(firstValue(query.returnTo));
  const signInHref = `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell
      eyebrow="NOUVEL ESPACE"
      title="Créer votre espace de veille."
      description="Votre espace personnel et une première liste de veille seront initialisés automatiquement."
      footer="Authentification gérée par Neon"
      switchText="Déjà inscrit ?"
      switchLabel="Se connecter"
      switchHref={signInHref}
    >
      <SignUpForm returnTo={returnTo} />
    </AuthShell>
  );
}
