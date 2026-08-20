"use client";

import Link from "next/link";
import { useState } from "react";
import { AtSign, LoaderCircle, LockKeyhole, UserRoundSearch } from "lucide-react";
import type { CompanyContact } from "@/types/company";

interface ContactPayload {
  domain?: string;
  contacts?: CompanyContact[];
  count?: number;
  dataPolicy?: string;
  error?: string;
  reason?: string;
}

export function ContactReveal({ siren, domain }: { siren: string; domain?: string }) {
  const [contacts, setContacts] = useState<CompanyContact[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  async function reveal() {
    setLoading(true);
    setMessage(null);
    setAuthRequired(false);
    try {
      const response = await fetch(`/api/v1/companies/${siren}/contacts?limit=8`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ContactPayload;
      if (response.status === 401) {
        setAuthRequired(true);
        setContacts([]);
        return;
      }
      if (!response.ok) {
        throw new Error(payload.reason || payload.error || "Enrichissement indisponible");
      }
      setContacts(payload.contacts || []);
      if (!payload.contacts?.length) setMessage("Aucun contact professionnel exploitable retourné pour ce domaine.");
    } catch (error) {
      setContacts([]);
      setMessage(error instanceof Error ? error.message : "Enrichissement indisponible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contact-reveal">
      {contacts === null ? (
        <div className="contact-gate">
          <div>
            <UserRoundSearch size={20} />
            <span>
              <strong>Contacts professionnels à la demande</strong>
              <small>{domain ? `Domaine résolu : ${domain}` : "Le domaine sera résolu avant l’enrichissement."}</small>
            </span>
          </div>
          <button type="button" onClick={reveal} disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <LockKeyhole size={15} />}
            {loading ? "Recherche…" : "Révéler les contacts"}
          </button>
        </div>
      ) : authRequired ? (
        <div className="contact-auth-required">
          <LockKeyhole size={18} />
          <div><strong>Connexion requise</strong><small>Les données de contact ne sont jamais enrichies massivement en accès public.</small></div>
          <Link href="/auth/sign-in">Se connecter</Link>
        </div>
      ) : contacts.length ? (
        <div className="contact-list">
          {contacts.map((contact) => (
            <div className="contact-row" key={contact.email}>
              <AtSign size={15} />
              <div>
                <strong>{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email}</strong>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
                <small>{[contact.position, contact.department, contact.seniority].filter(Boolean).join(" · ") || "Fonction non renseignée"}</small>
              </div>
              <span>{typeof contact.confidence === "number" ? `${Math.round(contact.confidence)}%` : contact.verificationStatus || "—"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-copy">{message || "Aucun contact professionnel retourné."}</div>
      )}
      {message && contacts?.length ? <p className="contact-note">{message}</p> : null}
    </div>
  );
}
