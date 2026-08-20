import type { ExplainableScore, SourceEvidence } from "@/types/company";

export type FactValue = string | number | boolean | null | string[];

export interface CompanyFact {
  type: "identity" | "activity" | "location" | "workforce" | "governance" | "structure";
  key: string;
  value: FactValue;
  evidence: SourceEvidence;
  fingerprint: string;
}

export interface CompanyEvent {
  type: "HEAD_OFFICE_MOVE" | "ACTIVITY_CHANGE" | "EMPLOYER_STATUS_CHANGE" | "ESTABLISHMENT_GROWTH" | "GOVERNANCE_CHANGE";
  title: string;
  description: string;
  observedAt: string;
  confidence: number;
  evidenceKeys: string[];
}

export interface CompanySignal {
  type: "EXPANSION" | "CHANGE";
  label: string;
  strength: number;
  reason: string;
  evidenceEventTypes: CompanyEvent["type"][];
}

export interface CompanyAnalysisMeta {
  persisted: boolean;
  databaseConfigured: boolean;
  engineVersion: string;
  analyzedAt: string;
}

export interface CompanyAnalysisResult<TCompany> {
  company: TCompany;
  facts: CompanyFact[];
  events: CompanyEvent[];
  signals: CompanySignal[];
  score: ExplainableScore;
  meta: CompanyAnalysisMeta;
}
