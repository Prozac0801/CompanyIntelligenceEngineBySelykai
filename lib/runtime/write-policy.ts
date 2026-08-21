export function isReadOnlyRuntime(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export function canWriteRuntimeState(): boolean {
  return !isReadOnlyRuntime();
}
