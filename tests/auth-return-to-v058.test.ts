import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

describe("V0.5.8 auth return target", () => {
  it("keeps an internal company path including query and hash", () => {
    expect(sanitizeReturnTo("/company/424925790?watch=1#overview"))
      .toBe("/company/424925790?watch=1#overview");
  });

  it("rejects absolute external URLs", () => {
    expect(sanitizeReturnTo("https://evil.example/company/424925790"))
      .toBe("/workspace");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeReturnTo("//evil.example/company/424925790"))
      .toBe("/workspace");
  });

  it("uses the caller fallback for an empty target", () => {
    expect(sanitizeReturnTo("", "/"))
      .toBe("/");
  });
});
