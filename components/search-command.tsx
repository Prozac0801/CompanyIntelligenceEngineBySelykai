"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowUpRight, Building2, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import type { CompanySummary } from "@/types/company";

interface SearchPayload {
  results: CompanySummary[];
  total: number;
  error?: string;
}

export function SearchCommand() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await fetch(`/api/v1/companies/search?q=${encodeURIComponent(q)}`);
      const payload = (await response.json()) as SearchPayload;
      if (!response.ok) throw new Error(payload.error || "Recherche indisponible");
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
          {loading ? <LoaderCircle className="spin" size={18} /> : "Analyser"}
        </button>
      </form>

      {!hasSearched && (
        <div className="search-empty">
          <div>
            <ShieldCheck size={19} />
            <span>La V1 interroge directement la source publique française et conserve la provenance.</span>
          </div>
          <span className="mono">FACT ≠ INFERENCE</span>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {hasSearched && !loading && !error && (
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
                    {company.nafCode && <span>NAF {company.nafCode}</span>}
                    {company.address && <span>{company.address}</span>}
                  </div>
                </div>
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}
