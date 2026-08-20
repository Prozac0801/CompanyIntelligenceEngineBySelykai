import { neon } from "@neondatabase/serverless";

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured. The engine can still run in read-only live-source mode.");
  }
  return neon(url);
}
