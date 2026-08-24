import { readProviderCache, writeProviderCache } from "./cache";

export type ProviderCapability = "apilayer-serp" | "apilayer-news" | "apilayer-geo";
export type ProviderCapabilityStatus = "healthy" | "degraded" | "auth_error" | "rate_limited";

export interface ProviderCapabilityState {
  capability: ProviderCapability;
  status: ProviderCapabilityStatus;
  checkedAt: string;
  retryAfter?: string;
}

const AUTH_BACKOFF_MS = 60 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;
const DEGRADED_BACKOFF_MS = 2 * 60 * 1000;
const HEALTHY_CACHE_MS = 5 * 60 * 1000;

export function capabilityCacheKey(capability: ProviderCapability): string {
  return `provider-capability:${capability}`;
}

export function capabilityStateFromHttp(
  capability: ProviderCapability,
  httpStatus: number,
  now = Date.now(),
): ProviderCapabilityState {
  const checkedAt = new Date(now).toISOString();
  if (httpStatus >= 200 && httpStatus < 300) {
    return { capability, status: "healthy", checkedAt };
  }

  let status: ProviderCapabilityStatus = "degraded";
  let backoffMs = DEGRADED_BACKOFF_MS;
  if (httpStatus === 401 || httpStatus === 403) {
    status = "auth_error";
    backoffMs = AUTH_BACKOFF_MS;
  } else if (httpStatus === 429) {
    status = "rate_limited";
    backoffMs = RATE_LIMIT_BACKOFF_MS;
  }

  return {
    capability,
    status,
    checkedAt,
    retryAfter: new Date(now + backoffMs).toISOString(),
  };
}

export function capabilityAllowsRequest(
  state: ProviderCapabilityState | null | undefined,
  now = Date.now(),
): boolean {
  if (!state || state.status === "healthy" || !state.retryAfter) return true;
  const retryAt = Date.parse(state.retryAfter);
  return !Number.isFinite(retryAt) || retryAt <= now;
}

function stateTtlSeconds(state: ProviderCapabilityState, now = Date.now()): number {
  if (state.status === "healthy") return Math.round(HEALTHY_CACHE_MS / 1000);
  const retryAt = state.retryAfter ? Date.parse(state.retryAfter) : now + DEGRADED_BACKOFF_MS;
  return Math.max(60, Math.ceil((retryAt - now) / 1000));
}

export async function readCapabilityState(
  capability: ProviderCapability,
): Promise<ProviderCapabilityState | null> {
  return readProviderCache<ProviderCapabilityState>(capabilityCacheKey(capability));
}

export async function writeCapabilityState(state: ProviderCapabilityState): Promise<void> {
  await writeProviderCache(
    "apilayer",
    capabilityCacheKey(state.capability),
    state,
    stateTtlSeconds(state),
  );
}

export async function recordCapabilityHttpResult(
  capability: ProviderCapability,
  httpStatus: number,
): Promise<ProviderCapabilityState> {
  const state = capabilityStateFromHttp(capability, httpStatus);
  await writeCapabilityState(state);
  return state;
}

export async function openCapabilityCircuit(
  capability: ProviderCapability,
  status: Exclude<ProviderCapabilityStatus, "healthy"> = "degraded",
  now = Date.now(),
): Promise<ProviderCapabilityState> {
  const backoffMs = status === "auth_error"
    ? AUTH_BACKOFF_MS
    : status === "rate_limited"
      ? RATE_LIMIT_BACKOFF_MS
      : DEGRADED_BACKOFF_MS;
  const state: ProviderCapabilityState = {
    capability,
    status,
    checkedAt: new Date(now).toISOString(),
    retryAfter: new Date(now + backoffMs).toISOString(),
  };
  await writeCapabilityState(state);
  return state;
}

export async function getProviderCapabilityDiagnostics(): Promise<ProviderCapabilityState[]> {
  const capabilities: ProviderCapability[] = ["apilayer-serp", "apilayer-news", "apilayer-geo"];
  const states = await Promise.all(capabilities.map(async (capability) => {
    const state = await readCapabilityState(capability);
    return state || {
      capability,
      status: "healthy" as const,
      checkedAt: new Date(0).toISOString(),
    };
  }));
  return states;
}
