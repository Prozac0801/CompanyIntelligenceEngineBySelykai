import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  workspaceFeedbackMessage,
  workspaceFeedbackPath,
} from "@/lib/workspaces/action-feedback";

describe("workspace action feedback v0.5.10", () => {
  it("keeps expected validation errors inside the workspace UI", () => {
    expect(workspaceFeedbackPath({ error: "invalid_siren", watchlistId: "abc" })).toBe(
      "/workspace?watchlist=abc&error=invalid_siren",
    );
    expect(workspaceFeedbackMessage("invalid_siren")).toContain("SIREN");
    expect(workspaceFeedbackMessage("company_not_found")).toContain("introuvable");
  });

  it("does not throw an expected invalid-SIREN exception from the add action", () => {
    const source = readFileSync(new URL("../app/workspace/actions.ts", import.meta.url), "utf8");
    expect(source).not.toContain('throw new Error("SIREN invalide.")');
    expect(source).toContain("workspaceFeedbackPath");
  });

  it("renders action feedback in the workspace", () => {
    const source = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("workspaceFeedbackMessage");
    expect(source).toContain("workspace-action-feedback");
  });
});
