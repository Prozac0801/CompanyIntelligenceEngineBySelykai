"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  CircleDashed,
  DatabaseZap,
  LoaderCircle,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CompanySummary } from "@/types/company";

interface SearchPayload {
  results: CompanySummary[];
  total: number;
  error?: string;
}

const SEARCH_PHASES = [
  { label: "Connexion au registre", detail: "Source publique française" },
  { label: "Recherche des correspondances", detail: "Nom · SIREN · SIRET · adresse" },
  { label: "Normalisation", detail: "Identité et établissements" },
  { label: "Préparation des résultats", detail: "Provenance et qualité" },
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SearchCommand() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => Math.min(current + 1, SEARCH_PHASES.length - 1));
    }, 320);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    setPhaseIndex(0);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    const startedAt = performance.now();
    try {
      const response = await fetch(`/api/v1/companies/search?q=${encodeURIComponent(q)}`);
      const payload = (await response.json()) as SearchPayload;
      if (!response.ok) throw new Error(payload.error || "Recherche indisponible");
      const elapsed = performance.now() - startedAt;
      if (elapsed < 720) await sleep(720 - elapsed);
      setResults(payload.results || []);
      setTotal(payload.total || 0);
    } catch (caught) {
      setResults([]);
      setTotal(0);
      setError(caught instanceof Error ? caught.message : "Recherche indisponible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="search-surface" aria-label="Recherche entreprise">
      <form className="search-form" onSubmit={onSubmit}>
        <Search size={21} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nom, SIREN, SIRET ou adresse…"
          aria-label="Nom, SIREN, SIRET ou adresse"
        />
        <button type="submit" disabled={loading || query.trim().length < 2}>
          {loading ? <><LoaderCircle className="spin" size={18} /> Analyse</> : "Analyser"}
        </button>
      </form>

      {loading ? (
        <div className="search-intelligence-loader" role="status" aria-live="polite">
          <div className="search-radar-stage">
            <div className="radar-orbit orbit-one" />
            <div className="radar-orbit orbit-two" />
            <div className="radar-sweep" />
            <div className="radar-core"><Radar size={22} /></div>
            <span className="radar-ping ping-one" />
            <span className="radar-ping ping-two" />
            <span className="radar-ping ping-three" />
          </div>
          <div className="search-progress-copy">
            <div className="search-progress-title"><Sparkles size={16} /> Recherche intelligente en cours</div>
            <p>Le moteur interroge et normalise les sources sans masquer la provenance.</p>
            <div className="search-phase-list">
              {SEARCH_PHASES.map((phase, index) => {
                const state = index < phaseIndex ? "done" : index === phaseIndex ? "active" : "pending";
                return (
                  <div className={`search-phase ${state}`} key={phase.label}>
                    <span className="phase-icon">
                      {state === "done" ? <Check size={13} /> : state === "active" ? <LoaderCircle className="spin" size={13} /> : <CircleDashed size={13} />}
                    </span>
                    <div><strong>{phase.label}</strong><small>{phase.detail}</small></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="search-loader-meta">
            <DatabaseZap size={15} />
            <span>FACT ≠ INFERENCE</span>
          </div>
        </div>
      ) : null}

      {!hasSearched && !loading && (
        <div className="search-empty">
          <div>
            <ShieldCheck size={19} />
            <span>Recherche officielle, puis enrichissement sourcé lors de l’ouverture d’une entreprise.</span>
          </div>
          <span className="mono">FACT ≠ INFERENCE</span>
        </div>
      )}

      {error && !loading ? <div className="error-banner">{error}</div> : null}

      {hasSearched && !loading && !error ? (
        <div className="result-stack">
          <div className="result-caption">
            <span>{total.toLocaleString("fr-FR")} résultat(s)</span>
            <span>source officielle · cache 10 min</span>
          </div>
          {results.length === 0 ? (
            <div className="no-result">Aucune entreprise trouvée pour cette recherche.</div>
          ) : (
            results.map((company) => (
              <Link key={company.siren} className="result-row" href={`/company/${company.siren}`}>
                <div className="result-icon"><Building2 size={19} /></div>
                <div className="result-main">
                  <div className="result-title-line">
                    <strong>{company.name}</strong>
                    <span className={`status-dot ${company.status}`} />
                  </div>
                  <div className="result-meta">
                    <span className="mono">SIREN {company.siren}</span>
                    {company.nafCode ? <span>NAF {company.nafCode}</span> : null}
                    {company.address ? <span>{company.address}</span> : null}
                  </div>
                </div>
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
