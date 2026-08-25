"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  CircleDashed,
  FileCheck2,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { latestRequestWins } from "@/lib/search/request-order";
import { detectSearchIntent } from "@/lib/search/query-intent";
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

export function SearchCommand() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const currentRequestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultListRef = useRef<HTMLDivElement>(null);
  const intent = useMemo(() => detectSearchIntent(query), [query]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => Math.min(current + 1, SEARCH_PHASES.length - 1));
    }, 320);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select") || target?.isContentEditable;
      if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;

    setPhaseIndex(0);
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/v1/companies/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      const payload = (await response.json()) as SearchPayload;
      if (!response.ok) throw new Error(payload.error || "Recherche indisponible");
      if (!latestRequestWins(requestId, currentRequestId.current)) return;
      setResults(payload.results || []);
      setTotal(payload.total || 0);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (!latestRequestWins(requestId, currentRequestId.current)) return;
      setResults([]);
      setTotal(0);
      setError(caught instanceof Error ? caught.message : "Recherche indisponible");
    } finally {
      if (latestRequestWins(requestId, currentRequestId.current)) {
        if (activeRequest.current === controller) activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function focusResult(index: number) {
    const links = resultListRef.current?.querySelectorAll<HTMLAnchorElement>("a.result-row");
    links?.item(index)?.focus();
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length && !loading) {
      event.preventDefault();
      focusResult(0);
    }
  }

  function onResultKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusResult(Math.min(index + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else focusResult(index - 1);
    }
  }

  return (
    <section className="search-surface" aria-label="Recherche entreprise" aria-busy={loading}>
      <div className="search-surface-head">
        <div><label htmlFor="company-search">Rechercher une entreprise</label><small>Nom · SIREN · SIRET · adresse</small></div>
        <div className="search-head-actions">
          <span className="search-availability"><i /> Source officielle prioritaire</span>
          <span className="search-shortcut"><kbd>/</kbd> focus</span>
        </div>
      </div>
      <form className="search-form" onSubmit={onSubmit}>
        <Search size={21} aria-hidden="true" />
        <div className="search-input-stack">
          <input
            ref={inputRef}
            id="company-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Nom, SIREN, SIRET ou adresse…"
            aria-label="Nom, SIREN, SIRET ou adresse"
            aria-describedby="company-search-intent"
            aria-keyshortcuts="/ ArrowDown"
            autoComplete="off"
          />
          <span id="company-search-intent" className={`search-intent intent-${intent.id}`}><i />{intent.label}<small>{intent.detail}</small></span>
        </div>
        <button type="submit" disabled={loading || query.trim().length < 2}>
          {loading ? <><LoaderCircle className="spin" size={18} aria-hidden="true" /> Recherche</> : <>Ouvrir l’analyse <ArrowUpRight size={17} aria-hidden="true" /></>}
        </button>
      </form>

      {loading ? (
        <div className="search-intelligence-loader">
          <span className="sr-only" role="status" aria-live="polite">Recherche dans les registres en cours.</span>
          <div className="search-progress-copy">
            <div className="search-progress-title"><LoaderCircle className="spin" size={16} aria-hidden="true" /> Vérification des registres en cours</div>
            <p>Les correspondances sont normalisées sans masquer leur provenance.</p>
            <div className="search-phase-list">
              {SEARCH_PHASES.map((phase, index) => {
                const state = index < phaseIndex ? "done" : index === phaseIndex ? "active" : "pending";
                return (
                  <div className={`search-phase ${state}`} key={phase.label}>
                    <span className="phase-icon">
                      {state === "done" ? <Check size={13} aria-hidden="true" /> : state === "active" ? <LoaderCircle className="spin" size={13} aria-hidden="true" /> : <CircleDashed size={13} aria-hidden="true" />}
                    </span>
                    <div><strong>{phase.label}</strong><small>{phase.detail}</small></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="search-loader-meta">
            <FileCheck2 size={15} aria-hidden="true" />
            <span>Faits et inférences restent séparés</span>
          </div>
        </div>
      ) : null}

      {!hasSearched && !loading && (
        <div className="search-empty">
          <div>
            <ShieldCheck size={19} aria-hidden="true" />
            <span>Recherche officielle, puis enrichissement sourcé lors de l’ouverture d’une entreprise.</span>
          </div>
          <span className="mono">FACT ≠ INFERENCE</span>
        </div>
      )}

      {error && !loading ? <div className="error-banner" role="alert">{error}</div> : null}

      {hasSearched && !loading && !error ? (
        <div className="result-stack" aria-live="polite" ref={resultListRef}>
          <div className="result-caption">
            <span>{total.toLocaleString("fr-FR")} résultat(s)</span>
            <span>source officielle · cache 10 min</span>
          </div>
          {results.length === 0 ? (
            <div className="no-result">Aucune entreprise trouvée pour cette recherche.</div>
          ) : (
            results.map((company, index) => (
              <Link
                key={company.siren}
                className="result-row"
                href={`/company/${company.siren}`}
                prefetch={false}
                onKeyDown={(event) => onResultKeyDown(event, index)}
              >
                <div className="result-icon"><Building2 size={19} aria-hidden="true" /></div>
                <div className="result-main">
                  <div className="result-title-line">
                    <strong>{company.name}</strong>
                    <span className={`result-status ${company.status}`}><i className={`status-dot ${company.status}`} />{company.status === "active" ? "Active" : company.status === "closed" ? "Fermée" : "À vérifier"}</span>
                  </div>
                  <div className="result-meta">
                    <span className="mono">SIREN {company.siren}</span>
                    {company.nafCode ? <span>NAF {company.nafCode}</span> : null}
                    {company.address ? <span>{company.address}</span> : null}
                  </div>
                  <div className="result-evidence"><ShieldCheck size={12} aria-hidden="true" /> {company.evidence.length} preuve(s) attachée(s)</div>
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
