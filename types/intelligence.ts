import type {
  CompanyBusinessTrigger,
  CompanyEnrichment,
  CompanyIntelligenceSummary,
  ExplainableScore,
  SourceEvidence,
} from "@/types/company";

export type FactValue = string | number | boolean | null | string[];

export interface CompanyFact {
  type:
    | "identity"
    | "activity"
    | "location"
    | "workforce"
    | "governance"
    | "structure"
    | "web"
    | "news"
    | "commercial"
    | "financial";
  key: string;
  value: FactValue;
  evidence: SourceEvidence;
  fingerprint: string;
}

export interface CompanyEvent {
  type:
    | "HEAD_OFFICE_MOVE"
    | "ACTIVITY_CHANGE"
    | "EMPLOYER_STATUS_CHANGE"
    | "ESTABLISHMENT_GROWTH"
    | "ESTABLISHMENT_OPENING"
    | "ESTABLISHMENT_CLOSURE"
    | "GOVERNANCE_CHANGE"
    | "BODACC_ACTIVITY"
    | "HIRING_ACTIVITY_CHANGE"
    | "PUBLIC_CONTRACT_AWARD"
    | "FINANCIAL_CHANGE";
  title: string;
  description: string;
  observedAt: string;
  confidence: number;
  evidenceKeys: string[];
}

export interface CompanySignal {
  type: "EXPANSION" | "CHANGE" | "LEGAL_RISK" | "HIRING" | "PROCUREMENT" | "CONTRACTION";
  label: string;
  strength: number;
  reason: string;
  evidenceEventTypes: CompanyEvent["type"][];
}

export interface CommercialActionPolicy {
  status: "allowed" | "blocked" | "unknown";
  reason: string;
}

export interface CompanyAnalysisMeta {
  persisted: boolean;
  databaseConfigured: boolean;
  engineVersion: string;
  analyzedAt: string;
}

export interface CompanyAnalysisResult<TCompany> {
  company: TCompany;
  enrichment: CompanyEnrichment;
  facts: CompanyFact[];
  events: CompanyEvent[];
  signals: CompanySignal[];
  triggers: CompanyBusinessTrigger[];
  commercialAction: CommercialActionPolicy;
  score: ExplainableScore;
  summary: CompanyIntelligenceSummary;
  meta: CompanyAnalysisMeta;
}
