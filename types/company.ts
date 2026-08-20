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

export interface CompanyWebIntelligence {
  domain?: string;
  websiteUrl?: string;
  description?: string;
  industry?: string;
  sector?: string;
  employeeEstimate?: string;
  trafficRank?: string;
  technologies: string[];
  phoneNumbers: string[];
  genericEmails: string[];
  linkedinHandle?: string;
  logoUrl?: string;
  serpPosition?: number;
  serpSnippet?: string;
}

export interface CompanyNewsItem {
  title: string;
  description?: string;
  url: string;
  source?: string;
  publishedAt?: string;
  language?: string;
}

export interface CompanyGeoIntelligence {
  latitude: number;
  longitude: number;
  label?: string;
  confidence?: number;
}

export interface CompanyEnrichment {
  web?: CompanyWebIntelligence;
  news: CompanyNewsItem[];
  geo?: CompanyGeoIntelligence;
  evidence: SourceEvidence[];
}

export interface CompanyContact {
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  seniority?: string;
  type?: string;
  confidence?: number;
  verificationStatus?: string;
  sources: string[];
}

export interface ScoreFactor {
  label: string;
  impact: number;
  evidence: string;
  group?: "health" | "growth" | "digital" | "commercial";
}

export interface ScoreSubscore {
  id: "health" | "growth" | "digital" | "commercial";
  label: string;
  value: number;
  weight: number;
  confidence: "low" | "medium" | "high";
  evidence: string[];
}

export interface ScoreBasis {
  mode: "absolute-evidence";
  description: string;
  coveragePercent: number;
  evidenceFamilies: string[];
  missingFamilies: string[];
  benchmarkStatus: "not-enough-data" | "available";
  benchmarkDescription: string;
  benchmarkPercentile?: number;
  benchmarkSampleSize?: number;
  benchmarkScope?: string;
}

export interface ExplainableScore {
  value: number;
  confidence: "low" | "medium" | "high";
  label: string;
  factors: ScoreFactor[];
  subscores: ScoreSubscore[];
  basis: ScoreBasis;
  version: string;
}
