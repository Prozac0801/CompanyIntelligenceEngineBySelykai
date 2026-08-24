import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><span>S</span><strong>SELYKAI</strong></Link>
        <div className="auth-copy">
          <p className="mono">COMPANY INTELLIGENCE ENGINE</p>
          <h1>Reprendre votre veille entreprise.</h1>
          <p>Accédez à vos listes surveillées, aux changements détectés et aux alertes de vos équipes.</p>
        </div>
        <SignInForm returnTo={returnTo} />
        <div className="auth-footer"><ShieldCheck size={14} /> Session sécurisée par Neon Auth</div>
        <p className="auth-switch">Pas encore de compte ? <Link href={signUpHref}>Créer un accès</Link></p>
      </section>
    </main>
  );
}
