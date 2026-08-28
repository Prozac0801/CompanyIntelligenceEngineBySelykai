import { createHash } from "node:crypto";
import type { CompanyEstablishment } from "@/types/company";
import type { CompanyEvent, CompanyFact, CompanySignal, FactValue } from "@/types/intelligence";

export interface EstablishmentWriteRow {
  siret: string;
  isHeadOffice: boolean;
  administrativeState: string | null;
  nafCode: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  openingDate: string | null;
}

export interface FactWriteRow {
  providerId: string;
  factType: CompanyFact["type"];
  factKey: string;
  value: FactValue;
  confidence: number;
  sourceUrl: string | null;
  fingerprint: string;
}

export interface EventWriteRow {
  providerId: string;
  eventType: CompanyEvent["type"];
  title: string;
  description: string;
  eventDate: string;
  confidence: number;
  evidenceKeys: string[];
  fingerprint: string;
}

export interface SignalWriteRow {
  signalType: CompanySignal["type"];
  label: string;
  strength: number;
  reason: string;
  evidenceEventTypes: CompanyEvent["type"][];
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function eventFingerprint(event: CompanyEvent): string {
  return hash({
    type: event.type,
    description: event.description,
    evidenceKeys: [...event.evidenceKeys].sort(),
  });
}

export function stableSnapshotPayload(facts: CompanyFact[]) {
  return facts
    .map((fact) => ({ key: fact.key, value: fact.value, fingerprint: fact.fingerprint }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function snapshotHash(facts: CompanyFact[]): string {
  return hash(stableSnapshotPayload(facts));
}

export function buildEstablishmentRows(establishments: CompanyEstablishment[]): EstablishmentWriteRow[] {
  return establishments.flatMap((item) => {
    if (!item.siret) return [];
    return [{
      siret: item.siret,
      isHeadOffice: item.headOffice ?? false,
      administrativeState: item.active === undefined ? null : item.active ? "active" : "closed",
      nafCode: item.nafCode || null,
      address: item.address || null,
      postalCode: item.postalCode || null,
      city: item.city || null,
      openingDate: item.createdAt || null,
    }];
  });
}

export function buildFactRows(facts: CompanyFact[]): FactWriteRow[] {
  return facts.map((fact) => ({
    providerId: fact.evidence.providerId || "recherche-entreprises",
    factType: fact.type,
    factKey: fact.key,
    value: fact.value,
    confidence: fact.evidence.confidence,
    sourceUrl: fact.evidence.sourceUrl || null,
    fingerprint: fact.fingerprint,
  }));
}

export function buildEventRows(events: CompanyEvent[], defaultProviderId: string): EventWriteRow[] {
  return events.map((event) => ({
    providerId: defaultProviderId,
    eventType: event.type,
    title: event.title,
    description: event.description,
    eventDate: event.observedAt,
    confidence: event.confidence,
    evidenceKeys: event.evidenceKeys,
    fingerprint: eventFingerprint(event),
  }));
}

export function buildSignalRows(signals: CompanySignal[]): SignalWriteRow[] {
  return signals.map((signal) => ({
    signalType: signal.type,
    label: signal.label,
    strength: signal.strength,
    reason: signal.reason,
    evidenceEventTypes: signal.evidenceEventTypes,
  }));
}
