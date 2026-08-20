const LEGAL_FORMS: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC",
  "5306": "Société en commandite simple",
  "5498": "SARL de famille",
  "5499": "SARL",
  "5505": "SA à participation ouvrière",
  "5510": "SA à conseil d’administration",
  "5520": "SA à directoire",
  "5599": "SA",
  "5699": "Société commerciale",
  "5710": "SAS",
  "5720": "SASU",
  "6100": "Caisse d’épargne / crédit mutuel",
  "6540": "SCI",
  "9220": "Association déclarée",
};

const NAF_LABELS: Record<string, string> = {
  "62.01Z": "Programmation informatique",
  "62.02A": "Conseil en systèmes et logiciels informatiques",
  "62.09Z": "Autres activités informatiques",
  "63.11Z": "Traitement de données, hébergement et activités connexes",
  "69.20Z": "Activités comptables",
  "70.22Z": "Conseil pour les affaires et autres conseils de gestion",
  "78.20Z": "Activités des agences de travail temporaire",
  "80.20Z": "Activités liées aux systèmes de sécurité",
  "82.99Z": "Autres activités de soutien aux entreprises",
  "85.59A": "Formation continue d’adultes",
};

export const EMPLOYEE_BANDS: Record<string, string> = {
  "00": "0 salarié",
  "01": "1–2 salariés",
  "02": "3–5 salariés",
  "03": "6–9 salariés",
  "11": "10–19 salariés",
  "12": "20–49 salariés",
  "21": "50–99 salariés",
  "22": "100–199 salariés",
  "31": "200–249 salariés",
  "32": "250–499 salariés",
  "41": "500–999 salariés",
  "42": "1 000–1 999 salariés",
  "51": "2 000–4 999 salariés",
  "52": "5 000–9 999 salariés",
  "53": "10 000+ salariés",
};

export function legalFormLabel(code?: string): string | undefined {
  if (!code) return undefined;
  return LEGAL_FORMS[code] || `Forme juridique ${code}`;
}

export function activityLabel(code?: string, supplied?: string): string | undefined {
  if (supplied?.trim()) return supplied.trim();
  if (!code) return undefined;
  return NAF_LABELS[code] || `Activité NAF ${code}`;
}

export function employeeBandLabel(code?: string): string | undefined {
  if (!code) return undefined;
  return EMPLOYEE_BANDS[code] || `Tranche d’effectif ${code}`;
}

export function formatFrenchDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
