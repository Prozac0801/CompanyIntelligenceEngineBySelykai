"use client";

import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Building2,
  CircleAlert,
  LoaderCircle,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { detectSearchIntent } from "@/lib/search/query-intent";
import type { CompanySummary } from "@/types/company";

interface SearchPayload {
  results: CompanySummary[];
  total: number;
  error?: string;
}

export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultListRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const requestId = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intent = detectSearchIntent(query);

  const openPalette = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    setIsOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closePalette = useCallback(() => {
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    activeRequest.current?.abort();
    requestId.current += 1;
    setQuery("");
    setResults([]);
    setTotal(0);
    setError(null);
    setLoading(false);
    dialogRef.current?.close();
  }, []);

  const runSearch = useCallback(async (rawQuery: string) => {
    const normalizedQuery = rawQuery.trim();
    if (normalizedQuery.length < 2) {
      activeRequest.current?.abort();
      setResults([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/companies/search?q=${encodeURIComponent(normalizedQuery)}`, {
        signal: controller.signal,
      });
      const payload = (await response.json()) as SearchPayload;
      if (!response.ok) throw new Error(payload.error || "Recherche indisponible");
      if (nextRequestId !== requestId.current) return;
      setResults(payload.results || []);
      setTotal(payload.total || 0);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (nextRequestId !== requestId.current) return;
      setResults([]);
      setTotal(0);
      setError(caught instanceof Error ? caught.message : "Recherche indisponible");
    } finally {
      if (nextRequestId === requestId.current) {
        if (activeRequest.current === controller) activeRequest.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openPalette]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;

    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = null;
      void runSearch(normalizedQuery);
    }, 280);
    return () => {
      if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    };
  }, [query, runSearch]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    void runSearch(query);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length >= 2) return;
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    activeRequest.current?.abort();
    requestId.current += 1;
    setResults([]);
    setTotal(0);
    setError(null);
    setLoading(false);
  }

  function focusResult(index: number) {
    const links = resultListRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-command-result]");
    links?.item(index)?.focus();
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) {
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
    <>
      <button className="command-trigger" type="button" onClick={openPalette} aria-haspopup="dialog" aria-expanded={isOpen}>
        <Search size={16} aria-hidden="true" />
        <span className="command-trigger-copy"><strong>Recherche rapide</strong><small>Depuis n’importe où</small></span>
        <kbd><span>⌘</span>K</kbd>
      </button>

      <dialog
        className="command-dialog"
        ref={dialogRef}
        aria-labelledby="command-title"
        aria-describedby="command-description"
        onCancel={(event) => {
          event.preventDefault();
          closePalette();
        }}
        onClose={() => setIsOpen(false)}
        onClick={(event: MouseEvent<HTMLDialogElement>) => {
          if (event.target === event.currentTarget) closePalette();
        }}
      >
        <div className="command-panel">
          <header className="command-panel-head">
            <div>
              <span className="command-live">Recherche multi-critères</span>
              <h2 id="command-title">Trouver une entreprise</h2>
              <p id="command-description">Nom, SIREN, SIRET ou adresse — le moteur adapte automatiquement la recherche.</p>
            </div>
            <button type="button" className="command-close" onClick={closePalette} aria-label="Fermer la recherche rapide">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <form className="command-search" role="search" onSubmit={onSubmit}>
            <Search size={21} aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Rechercher une entreprise…"
              aria-label="Rechercher une entreprise"
              aria-controls="command-results"
              aria-keyshortcuts="ArrowDown"
              autoComplete="off"
            />
            <span className={`command-intent intent-${intent.id}`}><i /> {intent.label}</span>
          </form>

          <div className="command-status" aria-live="polite">
            <span>{intent.detail}</span>
            <span>
              {loading ? <><LoaderCircle className="spin" size={13} aria-hidden="true" /> Interrogation du registre</> : null}
              {!loading && query.trim().length >= 2 && !error ? `${total.toLocaleString("fr-FR")} correspondance(s)` : null}
            </span>
          </div>

          <div className="command-results" id="command-results" ref={resultListRef}>
            {loading ? (
              <div className="command-skeletons" aria-hidden="true">
                <span /><span /><span />
              </div>
            ) : null}

            {!loading && error ? (
              <div className="command-message error" role="alert"><CircleAlert size={18} aria-hidden="true" />{error}</div>
            ) : null}

            {!loading && !error && query.trim().length < 2 ? (
              <div className="command-onboarding">
                <div><ShieldCheck size={18} aria-hidden="true" /><strong>Recherche officielle en priorité</strong></div>
                <p>Les enrichissements et signaux ne sont calculés qu’après l’ouverture volontaire d’une fiche.</p>
              </div>
            ) : null}

            {!loading && !error && query.trim().length >= 2 && results.length === 0 ? (
              <div className="command-message">Aucune entreprise trouvée pour cette recherche.</div>
            ) : null}

            {!loading && !error ? results.slice(0, 8).map((company, index) => (
              <Link
                data-command-result
                prefetch={false}
                href={`/company/${company.siren}`}
                className="command-result"
                key={company.siren}
                onClick={closePalette}
                onKeyDown={(event) => onResultKeyDown(event, index)}
              >
                <span className="command-result-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="command-result-icon"><Building2 size={17} aria-hidden="true" /></span>
                <span className="command-result-copy">
                  <strong>{company.name}</strong>
                  <small><span className={`status-dot ${company.status}`} /> SIREN {company.siren}{company.city ? ` · ${company.city}` : ""}</small>
                </span>
                <span className="command-result-evidence">{company.evidence.length} preuve(s)</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            )) : null}
          </div>

          <footer className="command-footer">
            <span><kbd><ArrowDown size={11} aria-hidden="true" /></kbd> naviguer</span>
            <span><kbd>↵</kbd> ouvrir</span>
            <span><kbd>esc</kbd> fermer</span>
            <strong>FACT ≠ INFERENCE</strong>
          </footer>
        </div>
      </dialog>
    </>
  );
}
