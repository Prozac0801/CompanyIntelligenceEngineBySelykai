export function latestRequestWins(requestId: number, currentRequestId: number): boolean {
  return requestId === currentRequestId;
}
