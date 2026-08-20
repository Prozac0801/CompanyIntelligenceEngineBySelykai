export type WorkspaceRole = "owner" | "admin" | "member";
export type MonitorFrequency = "daily" | "weekly" | "manual";
export type AlertSeverity = "info" | "medium" | "high" | "critical";
export type AlertStatus = "unread" | "read" | "archived";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface Watchlist {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistCompany {
  watchlistId: string;
  companyId: string;
  siren: string;
  name: string;
  monitorFrequency: MonitorFrequency;
  isActive: boolean;
  addedAt: string;
  lastCheckedAt?: string;
  nextCheckAt?: string;
  notes?: string;
}

export interface MonitoringTarget {
  watchlistId: string;
  workspaceId: string;
  companyId: string;
  siren: string;
  monitorFrequency: MonitorFrequency;
}

export interface IntelligenceAlert {
  id: string;
  workspaceId: string;
  watchlistId?: string;
  companyId: string;
  siren: string;
  companyName: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  body?: string;
  status: AlertStatus;
  createdAt: string;
  readAt?: string;
}
