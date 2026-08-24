import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><span>S</span><strong>SELYKAI</strong></Link>
        <div className="auth-copy">
          <p className="mono">COMPANY INTELLIGENCE ENGINE</p>
          <h1>Créer votre espace de veille.</h1>
          <p>Un espace personnel et une première watchlist seront créés automatiquement lors de votre première ouverture de la veille.</p>
        </div>
        <SignUpForm returnTo={returnTo} />
        <div className="auth-footer"><ShieldCheck size={14} /> Authentification gérée par Neon</div>
        <p className="auth-switch">Déjà inscrit ? <Link href={signInHref}>Se connecter</Link></p>
      </section>
    </main>
  );
}
