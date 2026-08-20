export type SourceKind = "official" | "commercial" | "web" | "inference";

export interface SourceEvidence {
  providerId?: string;
  provider: string;
  kind: SourceKind;
  observedAt: string;
  sourceUrl?: string;
  confidence: number;
}

export interface CompanyExecutive {
  name: string;
  role: string;
  type?: string;
}

export interface CompanyEstablishment {
  siret?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  nafCode?: string;
  active?: boolean;
  headOffice?: boolean;
  createdAt?: string;
}

export interface CompanySummary {
  siren: string;
  name: string;
  acronym?: string;
  legalForm?: string;
  nafCode?: string;
  activityLabel?: string;
  status: "active" | "closed" | "unknown";
  address?: string;
  postalCode?: string;
  city?: string;
  employeeBand?: string;
  companyCategory?: string;
  employer?: boolean;
  establishmentCount?: number;
  openEstablishmentCount?: number;
  createdAt?: string;
  evidence: SourceEvidence[];
}

export interface CompanyProfile extends CompanySummary {
  executives: CompanyExecutive[];
  establishments: CompanyEstablishment[];
  rawFinancials?: unknown;
}

export interface ScoreFactor {
  label: string;
  impact: number;
  evidence: string;
}

export interface ExplainableScore {
  value: number;
  confidence: "low" | "medium" | "high";
  label: string;
  factors: ScoreFactor[];
  version: string;
}
