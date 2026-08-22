import { describe, expect, it } from "vitest";
import { resolveActiveWatchlist } from "@/lib/workspaces/watchlist-selection";
import type { Watchlist } from "@/types/workspace";

const lists: Watchlist[] = [
  { id: "11111111-1111-4111-8111-111111111111", workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "À surveiller", createdAt: "2026-08-22T08:00:00.000Z", updatedAt: "2026-08-22T08:00:00.000Z" },
  { id: "22222222-2222-4222-8222-222222222222", workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Sud-Ouest", createdAt: "2026-08-22T08:00:00.000Z", updatedAt: "2026-08-22T08:00:00.000Z" },
];

describe("V0.5.7 watchlist navigation", () => {
  it("selects a requested watchlist that belongs to the loaded workspace", () => {
    expect(resolveActiveWatchlist(lists, lists[1].id)?.id).toBe(lists[1].id);
  });

  it("falls back to the first accessible watchlist for an unknown or external id", () => {
    expect(resolveActiveWatchlist(lists, "33333333-3333-4333-8333-333333333333")?.id).toBe(lists[0].id);
  });

  it("returns undefined when the workspace has no watchlists", () => {
    expect(resolveActiveWatchlist([], lists[0].id)).toBeUndefined();
  });
});
