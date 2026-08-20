"use server";

import { redirect } from "next/navigation";
import { auth, isAuthConfigured } from "@/lib/auth/server";

export interface AuthActionState {
  error?: string;
}

function configuredOrError(): AuthActionState | null {
  if (isAuthConfigured()) return null;
  return { error: "L’authentification n’est pas encore configurée sur cet environnement." };
}

export async function signInWithEmail(
  _previous: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState | never> {
  const configurationError = configuredOrError();
  if (configurationError) return configurationError;

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email et mot de passe requis." };

  const { error } = await auth.signIn.email({ email, password });
  if (error) return { error: error.message || "Connexion impossible." };
  redirect("/workspace");
}

export async function signUpWithEmail(
  _previous: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState | never> {
  const configurationError = configuredOrError();
  if (configurationError) return configurationError;

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !email || !password) return { error: "Nom, email et mot de passe requis." };
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };

  const { error } = await auth.signUp.email({ name, email, password });
  if (error) return { error: error.message || "Création du compte impossible." };
  redirect("/workspace");
}

export async function signOut(): Promise<never> {
  if (isAuthConfigured()) await auth.signOut();
  redirect("/");
}
