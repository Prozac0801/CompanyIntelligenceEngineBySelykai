export type AnalysisIntent = "interactive" | "monitoring" | "contact" | "bootstrap" | "refresh";

export type ProviderFamily =
  | "official-identity"
  | "commercial-policy"
  | "web-identity"
  | "legal-events"
  | "procurement"
  | "news"
  | "hiring";

export interface IntelligenceExecutionPolicy {
  intent: AnalysisIntent;
  providerFamilies: ProviderFamily[];
  detectEvents: boolean;
  persistAnalysis: boolean;
}

const FULL_FAMILIES: ProviderFamily[] = [
  "official-identity",
  "commercial-policy",
  "web-identity",
  "legal-events",
  "procurement",
  "news",
  "hiring",
];

export function executionPolicy(intent: AnalysisIntent): IntelligenceExecutionPolicy {
  if (intent === "contact") {
    return {
      intent,
      providerFamilies: ["official-identity", "commercial-policy", "web-identity"],
      detectEvents: false,
      persistAnalysis: false,
    };
  }
  if (intent === "bootstrap") {
    return {
      intent,
      providerFamilies: ["official-identity"],
      detectEvents: false,
      persistAnalysis: false,
    };
  }
  return {
    intent,
    providerFamilies: [...FULL_FAMILIES],
    detectEvents: true,
    persistAnalysis: true,
  };
}
