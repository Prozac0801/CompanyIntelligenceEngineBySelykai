import { AuthShell } from "@/components/auth-shell";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { SignInForm } from "./sign-in-form";

function firstValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  const returnTo = sanitizeReturnTo(firstValue(query.returnTo));
  const signUpHref = `/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell
      eyebrow="ESPACE SÉCURISÉ"
      title="Accéder à votre espace de veille."
      description="Retrouvez vos listes surveillées, les changements détectés et les alertes qui méritent une décision."
      footer="Session sécurisée par Neon Auth"
      switchText="Pas encore de compte ?"
      switchLabel="Créer un accès"
      switchHref={signUpHref}
    >
      <SignInForm returnTo={returnTo} />
    </AuthShell>
  );
}
