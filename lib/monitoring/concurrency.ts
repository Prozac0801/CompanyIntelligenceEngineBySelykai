export function normalizeMonitoringConcurrency(value: string | undefined): number {
  if (!value) return 2;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.max(1, Math.min(parsed, 4));
}

export function monitoringFailureDelayMinutes(message: string): number {
  const normalized = message.toLocaleLowerCase("fr-FR");
  if (normalized.includes("introuvable") || normalized.includes("not found")) {
    return 7 * 24 * 60;
  }
  return 60;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length, 4));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
